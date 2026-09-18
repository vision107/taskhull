import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { storageConfig } from "@/config/storage.config";
import { db } from "@/lib/db";
import { recordRevision } from "@/lib/db/revision";
import {
	AttachmentKind,
	BuildStatus,
	BuildTaskStatus,
	RevisionAction,
	RevisionEntity,
} from "@/lib/db/schema/enums";
import {
	buildTable,
	buildTaskAssignmentTable,
	buildTaskAttachmentTable,
	buildTaskChecklistItemTable,
	buildTaskCommentTable,
	buildTaskDependencyTable,
	buildTaskTable,
	templateTaskTable,
	templateVersionTable,
} from "@/lib/db/schema/manufacturing-tables";
import { memberTable, userTable } from "@/lib/db/schema/tables";
import {
	ActivityAction,
	logActivities,
	logActivity,
} from "@/lib/manufacturing/activity";
import {
	createBuildFromVersion,
	denyForeignPersonalBuild,
	getAccessibleBuildTask,
	getAvailableUpgrades,
	getOwnedBuild,
	getOwnedBuildTasks,
	isPersonalBuild,
	upgradeBuildToVersion,
} from "@/lib/manufacturing/builds";
import { notifyTasksAssigned } from "@/lib/manufacturing/notifications";
import { assertCanPlan } from "@/lib/manufacturing/permissions";
import {
	previewTemplateUpdate,
	saveBuildAsTemplate,
	updateTemplateFromBuild,
} from "@/lib/manufacturing/promote";
import { toDateString } from "@/lib/manufacturing/scheduling";
import {
	nextSiblingSortOrder,
	nextSortOrderForPhase,
} from "@/lib/manufacturing/sort-order";
import { getSubtaskParent } from "@/lib/manufacturing/subtasks";
import { getOwnedTemplate } from "@/lib/manufacturing/template-versions";
import { normalizeContentType } from "@/lib/manufacturing/uploads";
import { getSignedUploadUrl } from "@/lib/storage";
import {
	addBuildTaskChecklistItemSchema,
	addBuildTaskDocumentSchema,
	assignBuildTasksSchema,
	assignmentGridSchema,
	buildTaskDocumentUploadUrlSchema,
	createBuildSchema,
	createBuildTaskSchema,
	deleteBuildSchema,
	deleteBuildTaskSchema,
	getBuildSchema,
	listBuildsSchema,
	removeBuildTaskChecklistItemSchema,
	removeBuildTaskDocumentSchema,
	saveBuildAsTemplateSchema,
	templateDiffSchema,
	unassignBuildTasksSchema,
	updateBuildSchema,
	updateBuildTaskSchema,
	updateTemplateFromBuildSchema,
	upgradeBuildSchema,
} from "@/schemas/manufacturing-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

const OPEN_BUILD_STATUSES = [
	BuildStatus.planned,
	BuildStatus.active,
	BuildStatus.blocked,
];

function sanitizeFileName(fileName: string): string {
	return fileName.replace(/[^a-zA-Z0-9\-_.]/g, "_").slice(0, 120);
}

/**
 * Planners may edit any shared project. The owner of a personal list may
 * edit that list even when they are a regular member.
 */
async function requireEditableBuild(
	buildId: string,
	organizationId: string,
	userId: string,
	role: string,
) {
	const build = await getOwnedBuild(buildId, organizationId);
	denyForeignPersonalBuild(build, userId);
	if (!isPersonalBuild(build)) {
		assertCanPlan(role);
	}
	return build;
}

async function requireEditableBuildTask(
	buildTaskId: string,
	organizationId: string,
	userId: string,
	role: string,
) {
	const { task, build } = await getAccessibleBuildTask(
		buildTaskId,
		organizationId,
		userId,
	);
	if (!isPersonalBuild(build)) {
		assertCanPlan(role);
	}
	return { task, build };
}

async function denyPersonalAssignment(
	tasks: { buildId: string }[],
	organizationId: string,
): Promise<void> {
	const buildIds = [...new Set(tasks.map((task) => task.buildId))];
	if (buildIds.length === 0) return;
	const builds = await db.query.buildTable.findMany({
		where: and(
			inArray(buildTable.id, buildIds),
			eq(buildTable.organizationId, organizationId),
		),
		columns: { ownerUserId: true },
	});
	if (builds.some((build) => isPersonalBuild(build))) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Personal list tasks are not shared with the team.",
		});
	}
}

/** Subquery: ids of all versions of a template. */
function versionIdsOf(templateId: string) {
	return db
		.select({ id: templateVersionTable.id })
		.from(templateVersionTable)
		.where(eq(templateVersionTable.templateId, templateId));
}

function addDays(isoDate: string, days: number): string {
	const date = new Date(`${isoDate}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return toDateString(date);
}

/**
 * Validates the dependency ids a planner picked for a build task: all must
 * belong to the same build, none may be the task itself, and none may
 * (transitively) depend on the task, which would create a cycle.
 */
async function resolveDependencies(
	buildId: string,
	taskId: string | null,
	dependsOnIds: string[],
): Promise<{ id: string; endDate: string | null }[]> {
	const unique = Array.from(new Set(dependsOnIds));
	if (unique.length === 0) return [];
	if (taskId && unique.includes(taskId)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A task cannot depend on itself.",
		});
	}

	const rows = await db
		.select({ id: buildTaskTable.id, endDate: buildTaskTable.endDate })
		.from(buildTaskTable)
		.where(
			and(
				eq(buildTaskTable.buildId, buildId),
				inArray(buildTaskTable.id, unique),
			),
		);
	if (rows.length !== unique.length) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Dependencies must be tasks of the same build.",
		});
	}

	if (taskId) {
		// Walk upstream from each chosen dependency; hitting taskId = cycle.
		const edges = await db
			.select({
				from: buildTaskDependencyTable.buildTaskId,
				to: buildTaskDependencyTable.dependsOnBuildTaskId,
			})
			.from(buildTaskDependencyTable)
			.innerJoin(
				buildTaskTable,
				eq(buildTaskTable.id, buildTaskDependencyTable.buildTaskId),
			)
			.where(eq(buildTaskTable.buildId, buildId));
		const upstream = new Map<string, string[]>();
		for (const edge of edges) {
			upstream.set(edge.from, [...(upstream.get(edge.from) ?? []), edge.to]);
		}
		const seen = new Set<string>();
		const stack = [...unique];
		while (stack.length > 0) {
			const current = stack.pop()!;
			if (current === taskId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "That order would create a loop between tasks.",
				});
			}
			if (seen.has(current)) continue;
			seen.add(current);
			stack.push(...(upstream.get(current) ?? []));
		}
	}

	return rows;
}

export const organizationBuildRouter = createTRPCRouter({
	list: protectedOrganizationProcedure
		.input(listBuildsSchema)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(buildTable.organizationId, ctx.organization.id),
				isNull(buildTable.ownerUserId),
			];
			if (input.productId) {
				conditions.push(eq(buildTable.productId, input.productId));
			}
			if (input.templateId) {
				conditions.push(
					inArray(buildTable.templateVersionId, versionIdsOf(input.templateId)),
				);
			}
			if (input.status && input.status.length > 0) {
				conditions.push(inArray(buildTable.status, input.status));
			} else if (!input.includeArchived) {
				conditions.push(ne(buildTable.status, BuildStatus.archived));
			}

			const builds = await db.query.buildTable.findMany({
				where: and(...conditions),
				orderBy: [asc(buildTable.plannedStartDate), desc(buildTable.createdAt)],
				with: {
					product: { columns: { id: true, name: true } },
					templateVersion: {
						columns: { id: true, versionNumber: true, templateId: true },
						with: { template: { columns: { id: true, name: true } } },
					},
				},
			});

			if (builds.length === 0) return [];

			const progress = await db
				.select({
					buildId: buildTaskTable.buildId,
					total: sql<number>`count(*)::int`,
					done: sql<number>`count(*) filter (where ${buildTaskTable.status} = ${BuildTaskStatus.done})::int`,
					blocked: sql<number>`count(*) filter (where ${buildTaskTable.status} = ${BuildTaskStatus.blocked})::int`,
				})
				.from(buildTaskTable)
				.where(
					inArray(
						buildTaskTable.buildId,
						builds.map((build) => build.id),
					),
				)
				.groupBy(buildTaskTable.buildId);
			const progressByBuild = new Map(
				progress.map((row) => [row.buildId, row]),
			);

			return builds.map((build) => {
				const stats = progressByBuild.get(build.id);
				return {
					...build,
					taskCount: stats?.total ?? 0,
					doneTaskCount: stats?.done ?? 0,
					blockedTaskCount: stats?.blocked ?? 0,
				};
			});
		}),

	get: protectedOrganizationProcedure
		.input(getBuildSchema)
		.query(async ({ ctx, input }) => {
			const build = await db.query.buildTable.findFirst({
				where: and(
					eq(buildTable.id, input.id),
					eq(buildTable.organizationId, ctx.organization.id),
				),
				with: {
					product: { columns: { id: true, name: true } },
					templateVersion: {
						columns: { id: true, versionNumber: true, templateId: true },
						with: { template: { columns: { id: true, name: true } } },
					},
					tasks: {
						orderBy: [
							asc(buildTaskTable.sortOrder),
							asc(buildTaskTable.createdAt),
						],
						with: {
							assignments: {
								with: {
									user: { columns: { id: true, name: true, image: true } },
								},
							},
							checklistItems: {
								columns: { id: true, status: true },
							},
							dependencies: {
								columns: { dependsOnBuildTaskId: true },
							},
							comments: { columns: { id: true } },
							attachments: { columns: { id: true, templateDocumentId: true } },
						},
					},
				},
			});

			if (!build) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Build not found." });
			}
			denyForeignPersonalBuild(build, ctx.user.id);

			const availableUpgrades = await getAvailableUpgrades(build);

			// Subtask progress per parent, from the flat task list.
			const subtaskCounts = new Map<string, { total: number; done: number }>();
			for (const task of build.tasks) {
				if (!task.parentTaskId) continue;
				const counts = subtaskCounts.get(task.parentTaskId) ?? {
					total: 0,
					done: 0,
				};
				counts.total++;
				if (task.status === BuildTaskStatus.done) counts.done++;
				subtaskCounts.set(task.parentTaskId, counts);
			}

			return {
				...build,
				availableUpgrades,
				tasks: build.tasks.map((task) => ({
					...task,
					subtaskTotalCount: subtaskCounts.get(task.id)?.total ?? 0,
					subtaskDoneCount: subtaskCounts.get(task.id)?.done ?? 0,
					commentCount: task.comments.length,
					attachmentCount: task.attachments.length,
					checklistDoneCount: task.checklistItems.filter(
						(item) => item.status !== "open",
					).length,
					checklistTotalCount: task.checklistItems.length,
					comments: undefined,
					attachments: undefined,
				})),
			};
		}),

	create: protectedOrganizationProcedure
		.input(createBuildSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);

			const duplicate = await db.query.buildTable.findFirst({
				where: and(
					eq(buildTable.organizationId, ctx.organization.id),
					eq(buildTable.serialNumber, input.serialNumber),
				),
				columns: { id: true },
			});
			if (duplicate) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A project with this serial number already exists.",
				});
			}

			const build = await createBuildFromVersion({
				organizationId: ctx.organization.id,
				userId: ctx.user.id,
				productId: input.productId,
				templateId: input.templateId,
				templateVersionId: input.templateVersionId,
				serialNumber: input.serialNumber,
				name: input.name,
				description: input.description,
				plannedStartDate: input.plannedStartDate,
			});

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.build,
				entityId: build.id,
				action: RevisionAction.create,
				changedById: ctx.user.id,
				after: build,
			});

			return build;
		}),

	update: protectedOrganizationProcedure
		.input(updateBuildSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedBuild(input.id, ctx.organization.id);
			denyForeignPersonalBuild(before, ctx.user.id);

			if (input.serialNumber && input.serialNumber !== before.serialNumber) {
				const duplicate = await db.query.buildTable.findFirst({
					where: and(
						eq(buildTable.organizationId, ctx.organization.id),
						eq(buildTable.serialNumber, input.serialNumber),
						ne(buildTable.id, input.id),
					),
					columns: { id: true },
				});
				if (duplicate) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A project with this serial number already exists.",
					});
				}
			}

			const { id, ...changes } = input;
			const [after] = await db
				.update(buildTable)
				.set(
					Object.fromEntries(
						Object.entries(changes).filter(([, value]) => value !== undefined),
					),
				)
				.where(eq(buildTable.id, id))
				.returning();

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.build,
				entityId: id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
			});

			if (input.status && input.status !== before.status) {
				await logActivity({
					organizationId: ctx.organization.id,
					buildId: id,
					actorId: ctx.user.id,
					action: ActivityAction.buildStatusChanged,
					metadata: { from: before.status, to: input.status },
				});
			}

			return after;
		}),

	delete: protectedOrganizationProcedure
		.input(deleteBuildSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedBuild(input.id, ctx.organization.id);
			denyForeignPersonalBuild(before, ctx.user.id);

			const startedTasks = await db.$count(
				buildTaskTable,
				and(
					eq(buildTaskTable.buildId, input.id),
					ne(buildTaskTable.status, BuildTaskStatus.todo),
				),
			);
			if (startedTasks > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This build has tasks that were already worked on. Archive it instead of deleting.",
				});
			}

			await db.delete(buildTable).where(eq(buildTable.id, input.id));

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.build,
				entityId: input.id,
				action: RevisionAction.delete,
				changedById: ctx.user.id,
				before,
			});

			return { success: true };
		}),

	// -------------------------------------------------------------------------
	// Tasks (planner edits)
	// -------------------------------------------------------------------------

	/**
	 * Apply a newer published template version to an open build, keeping the
	 * work already done. See `upgradeBuildToVersion` for the merge rules.
	 */
	upgradeToVersion: protectedOrganizationProcedure
		.input(upgradeBuildSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			return upgradeBuildToVersion({
				organizationId: ctx.organization.id,
				userId: ctx.user.id,
				buildId: input.buildId,
				templateVersionId: input.templateVersionId,
			});
		}),

	// -------------------------------------------------------------------------
	// Project ⇄ template
	// -------------------------------------------------------------------------

	/** Turn an unlinked project into a new template (published v1). */
	saveAsTemplate: protectedOrganizationProcedure
		.input(saveBuildAsTemplateSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const result = await saveBuildAsTemplate({
				organizationId: ctx.organization.id,
				userId: ctx.user.id,
				buildId: input.buildId,
				name: input.name,
				description: input.description,
			});
			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.template,
				entityId: result.template.id,
				action: RevisionAction.create,
				changedById: ctx.user.id,
				after: result.template,
			});
			return result;
		}),

	/** Preview of what "Update template" would change. */
	templateDiff: protectedOrganizationProcedure
		.input(templateDiffSchema)
		.query(async ({ ctx, input }) =>
			previewTemplateUpdate({
				organizationId: ctx.organization.id,
				buildId: input.buildId,
			}),
		),

	/** Push a linked project's tasks into its template as a new version. */
	updateTemplate: protectedOrganizationProcedure
		.input(updateTemplateFromBuildSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			return updateTemplateFromBuild({
				organizationId: ctx.organization.id,
				userId: ctx.user.id,
				buildId: input.buildId,
				changeNote: input.changeNote,
			});
		}),

	// -------------------------------------------------------------------------
	// Documents on project tasks (planner side)
	// -------------------------------------------------------------------------

	taskDocumentUploadUrl: protectedOrganizationProcedure
		.input(buildTaskDocumentUploadUrlSchema)
		.mutation(async ({ ctx, input }) => {
			const { task } = await requireEditableBuildTask(
				input.buildTaskId,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);
			const storageKey = `orgs/${ctx.organization.id}/builds/${task.buildId}/tasks/${task.id}/docs/${crypto.randomUUID()}-${sanitizeFileName(input.fileName)}`;
			const signedUrl = await getSignedUploadUrl(
				storageKey,
				storageConfig.bucketNames.images,
				normalizeContentType(input.contentType),
				input.sizeBytes,
			);
			return { storageKey, signedUrl };
		}),

	addTaskDocument: protectedOrganizationProcedure
		.input(addBuildTaskDocumentSchema)
		.mutation(async ({ ctx, input }) => {
			const { task } = await requireEditableBuildTask(
				input.buildTaskId,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);
			if (!input.storageKey.startsWith(`orgs/${ctx.organization.id}/`)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid storage key.",
				});
			}
			const [attachment] = await db
				.insert(buildTaskAttachmentTable)
				.values({
					buildTaskId: task.id,
					kind: AttachmentKind.document,
					uploadedById: ctx.user.id,
					storageKey: input.storageKey,
					fileName: input.fileName,
					contentType: normalizeContentType(input.contentType),
					sizeBytes: input.sizeBytes,
				})
				.returning();
			if (!attachment) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to add document.",
				});
			}
			await logActivity({
				organizationId: ctx.organization.id,
				buildId: task.buildId,
				buildTaskId: task.id,
				actorId: ctx.user.id,
				action: ActivityAction.taskAttachmentAdded,
				metadata: { fileName: attachment.fileName, kind: attachment.kind },
			});
			return attachment;
		}),

	removeTaskDocument: protectedOrganizationProcedure
		.input(removeBuildTaskDocumentSchema)
		.mutation(async ({ ctx, input }) => {
			const attachment = await db.query.buildTaskAttachmentTable.findFirst({
				where: eq(buildTaskAttachmentTable.id, input.id),
			});
			if (!attachment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Document not found.",
				});
			}
			await requireEditableBuildTask(
				attachment.buildTaskId,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);
			if (attachment.kind !== AttachmentKind.document) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only documents can be removed here.",
				});
			}
			await db
				.delete(buildTaskAttachmentTable)
				.where(eq(buildTaskAttachmentTable.id, input.id));
			return { success: true };
		}),

	// Checklist items on project tasks. Template items are copied on create;
	// these let a planner add or drop items on one unit.
	addChecklistItem: protectedOrganizationProcedure
		.input(addBuildTaskChecklistItemSchema)
		.mutation(async ({ ctx, input }) => {
			const { task } = await requireEditableBuildTask(
				input.buildTaskId,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);
			const [sortRow] = await db
				.select({ maxSort: sql<number>`coalesce(max(sort_order), -1)::int` })
				.from(buildTaskChecklistItemTable)
				.where(eq(buildTaskChecklistItemTable.buildTaskId, task.id));
			const [item] = await db
				.insert(buildTaskChecklistItemTable)
				.values({
					buildTaskId: task.id,
					title: input.title,
					sortOrder: (sortRow?.maxSort ?? -1) + 1,
				})
				.returning();
			if (!item) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to add checklist item.",
				});
			}
			await logActivity({
				organizationId: ctx.organization.id,
				buildId: task.buildId,
				buildTaskId: task.id,
				actorId: ctx.user.id,
				action: ActivityAction.taskUpdated,
				metadata: { title: task.title, fields: ["checklist"] },
			});
			return item;
		}),

	removeChecklistItem: protectedOrganizationProcedure
		.input(removeBuildTaskChecklistItemSchema)
		.mutation(async ({ ctx, input }) => {
			const item = await db.query.buildTaskChecklistItemTable.findFirst({
				where: eq(buildTaskChecklistItemTable.id, input.id),
			});
			if (!item) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Checklist item not found.",
				});
			}
			const { task } = await requireEditableBuildTask(
				item.buildTaskId,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);
			await db
				.delete(buildTaskChecklistItemTable)
				.where(eq(buildTaskChecklistItemTable.id, input.id));
			await logActivity({
				organizationId: ctx.organization.id,
				buildId: task.buildId,
				buildTaskId: task.id,
				actorId: ctx.user.id,
				action: ActivityAction.taskUpdated,
				metadata: { title: task.title, fields: ["checklist"] },
			});
			return { success: true };
		}),

	createTask: protectedOrganizationProcedure
		.input(createBuildTaskSchema)
		.mutation(async ({ ctx, input }) => {
			const build = await requireEditableBuild(
				input.buildId,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);

			// Subtasks sit under their parent (one level), share its phase and
			// are appended after their siblings. Top-level tasks land inside
			// their phase group (after its last task) so the grouped list
			// doesn't show the same phase twice; else append.
			const parent = input.parentTaskId
				? await getSubtaskParent(buildTaskTable, input.parentTaskId, {
						buildId: build.id,
					})
				: null;
			const phase = parent ? parent.phase : (input.phase ?? null);
			const sortOrder = parent
				? await nextSiblingSortOrder(
						buildTaskTable,
						eq(buildTaskTable.parentTaskId, parent.id),
					)
				: await nextSortOrderForPhase(
						buildTaskTable,
						and(
							eq(buildTaskTable.buildId, build.id),
							isNull(buildTaskTable.parentTaskId),
						)!,
						phase,
					);

			const dependsOn = await resolveDependencies(
				build.id,
				null,
				input.dependsOnIds,
			);

			// Default start: after the latest dependency, else the build start.
			const latestDependencyEnd = dependsOn
				.map((dep) => dep.endDate)
				.filter((d): d is string => Boolean(d))
				.sort()
				.at(-1);
			const startDate =
				input.startDate ??
				latestDependencyEnd ??
				parent?.startDate ??
				build.plannedStartDate ??
				toDateString(new Date());

			const [task] = await db
				.insert(buildTaskTable)
				.values({
					organizationId: ctx.organization.id,
					buildId: build.id,
					parentTaskId: parent?.id ?? null,
					title: input.title,
					instructions: input.instructions ?? null,
					phase,
					sortOrder,
					plannedDurationDays: input.plannedDurationDays,
					plannedHours: input.plannedHours ?? null,
					startDate,
					endDate: addDays(startDate, input.plannedDurationDays),
					requiresPhoto: input.requiresPhoto,
					requiresComment: input.requiresComment,
				})
				.returning();

			if (!task) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create task.",
				});
			}

			if (dependsOn.length > 0) {
				await db.insert(buildTaskDependencyTable).values(
					dependsOn.map((dep) => ({
						buildTaskId: task.id,
						dependsOnBuildTaskId: dep.id,
					})),
				);
			}

			await logActivity({
				organizationId: ctx.organization.id,
				buildId: build.id,
				buildTaskId: task.id,
				actorId: ctx.user.id,
				action: ActivityAction.taskCreated,
				metadata: { title: task.title },
			});

			return task;
		}),

	updateTask: protectedOrganizationProcedure
		.input(updateBuildTaskSchema)
		.mutation(async ({ ctx, input }) => {
			const { task: before } = await requireEditableBuildTask(
				input.id,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);

			const { id, dependsOnIds, ...changes } = input;
			const patch: Record<string, unknown> = Object.fromEntries(
				Object.entries(changes).filter(([, value]) => value !== undefined),
			);

			// Keep the end date consistent when start or duration move and the
			// caller did not set an explicit end.
			const nextStart =
				(patch.startDate as string | null | undefined) ?? before.startDate;
			const nextDuration =
				(patch.plannedDurationDays as number | undefined) ??
				before.plannedDurationDays;
			if (
				patch.endDate === undefined &&
				nextStart &&
				(patch.startDate !== undefined ||
					patch.plannedDurationDays !== undefined)
			) {
				patch.endDate = addDays(nextStart, nextDuration);
			}

			const dependsOn =
				dependsOnIds !== undefined
					? await resolveDependencies(before.buildId, before.id, dependsOnIds)
					: null;

			const after = await db.transaction(async (tx) => {
				const [row] =
					Object.keys(patch).length > 0
						? await tx
								.update(buildTaskTable)
								.set(patch)
								.where(eq(buildTaskTable.id, id))
								.returning()
						: [before];

				// Subtasks follow their parent's phase.
				if (patch.phase !== undefined) {
					await tx
						.update(buildTaskTable)
						.set({ phase: (patch.phase as string | null) ?? null })
						.where(eq(buildTaskTable.parentTaskId, id));
				}

				if (dependsOn) {
					await tx
						.delete(buildTaskDependencyTable)
						.where(eq(buildTaskDependencyTable.buildTaskId, id));
					if (dependsOn.length > 0) {
						await tx.insert(buildTaskDependencyTable).values(
							dependsOn.map((dep) => ({
								buildTaskId: id,
								dependsOnBuildTaskId: dep.id,
							})),
						);
					}
				}
				return row;
			});

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.buildTask,
				entityId: id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
			});
			await logActivity({
				organizationId: ctx.organization.id,
				buildId: before.buildId,
				buildTaskId: id,
				actorId: ctx.user.id,
				action: ActivityAction.taskUpdated,
				metadata: {
					title: after?.title ?? before.title,
					fields: [
						...Object.keys(patch),
						...(dependsOn ? ["dependencies"] : []),
					],
				},
			});

			return after;
		}),

	deleteTask: protectedOrganizationProcedure
		.input(deleteBuildTaskSchema)
		.mutation(async ({ ctx, input }) => {
			const { task: before } = await requireEditableBuildTask(
				input.id,
				ctx.organization.id,
				ctx.user.id,
				ctx.membership.role,
			);

			if (before.status !== BuildTaskStatus.todo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only tasks that have not been started can be deleted.",
				});
			}

			// Deleting a parent takes its subtasks with it; refuse when any of
			// them has work on it.
			const startedSubtasks = await db.$count(
				buildTaskTable,
				and(
					eq(buildTaskTable.parentTaskId, before.id),
					ne(buildTaskTable.status, BuildTaskStatus.todo),
				),
			);
			if (startedSubtasks > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This task has subtasks that were already started.",
				});
			}

			await db.delete(buildTaskTable).where(eq(buildTaskTable.id, input.id));

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.buildTask,
				entityId: input.id,
				action: RevisionAction.delete,
				changedById: ctx.user.id,
				before,
			});

			return { success: true };
		}),

	// -------------------------------------------------------------------------
	// Assignment
	// -------------------------------------------------------------------------

	/**
	 * Members of the organization who can be assigned to tasks.
	 */
	assignees: protectedOrganizationProcedure.query(async ({ ctx }) => {
		const rows = await db
			.select({
				id: userTable.id,
				name: userTable.name,
				email: userTable.email,
				image: userTable.image,
				role: memberTable.role,
			})
			.from(memberTable)
			.innerJoin(userTable, eq(memberTable.userId, userTable.id))
			.where(eq(memberTable.organizationId, ctx.organization.id))
			.orderBy(asc(userTable.name));

		return rows;
	}),

	/**
	 * Assign one worker to many build tasks at once — the "give all four
	 * 'Wire control cabinet' tasks to Anna" operation.
	 */
	assign: protectedOrganizationProcedure
		.input(assignBuildTasksSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);

			const membership = await db.query.memberTable.findFirst({
				where: and(
					eq(memberTable.organizationId, ctx.organization.id),
					eq(memberTable.userId, input.userId),
				),
				columns: { id: true },
			});
			if (!membership) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "That user is not a member of this organization.",
				});
			}

			const tasks = await getOwnedBuildTasks(
				input.buildTaskIds,
				ctx.organization.id,
			);
			for (const task of tasks) {
				const build = await getOwnedBuild(task.buildId, ctx.organization.id);
				denyForeignPersonalBuild(build, ctx.user.id);
			}
			await denyPersonalAssignment(tasks, ctx.organization.id);
			const taskIds = tasks.map((task) => task.id);

			await db.transaction(async (tx) => {
				if (input.replace) {
					await tx
						.delete(buildTaskAssignmentTable)
						.where(
							and(
								inArray(buildTaskAssignmentTable.buildTaskId, taskIds),
								eq(buildTaskAssignmentTable.role, input.role),
								ne(buildTaskAssignmentTable.userId, input.userId),
							),
						);
				}

				await tx
					.insert(buildTaskAssignmentTable)
					.values(
						taskIds.map((buildTaskId) => ({
							buildTaskId,
							userId: input.userId,
							role: input.role,
							assignedById: ctx.user.id,
						})),
					)
					.onConflictDoNothing();
			});

			await logActivities(
				tasks.map((task) => ({
					organizationId: ctx.organization.id,
					buildId: task.buildId,
					buildTaskId: task.id,
					actorId: ctx.user.id,
					action: ActivityAction.taskAssigned,
					metadata: { userId: input.userId, role: input.role },
				})),
			);

			const builds = await db.query.buildTable.findMany({
				where: inArray(
					buildTable.id,
					Array.from(new Set(tasks.map((task) => task.buildId))),
				),
				columns: { id: true, serialNumber: true },
			});
			await notifyTasksAssigned({
				organizationId: ctx.organization.id,
				actorId: ctx.user.id,
				assigneeId: input.userId,
				tasks: tasks.map((task) => ({
					id: task.id,
					title: task.title,
					buildId: task.buildId,
				})),
				serialByBuildId: new Map(builds.map((b) => [b.id, b.serialNumber])),
			});

			return { assigned: taskIds.length };
		}),

	unassign: protectedOrganizationProcedure
		.input(unassignBuildTasksSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const tasks = await getOwnedBuildTasks(
				input.buildTaskIds,
				ctx.organization.id,
			);
			for (const task of tasks) {
				const build = await getOwnedBuild(task.buildId, ctx.organization.id);
				denyForeignPersonalBuild(build, ctx.user.id);
			}
			await denyPersonalAssignment(tasks, ctx.organization.id);
			const taskIds = tasks.map((task) => task.id);

			await db
				.delete(buildTaskAssignmentTable)
				.where(
					and(
						inArray(buildTaskAssignmentTable.buildTaskId, taskIds),
						eq(buildTaskAssignmentTable.userId, input.userId),
						input.role
							? eq(buildTaskAssignmentTable.role, input.role)
							: undefined,
					),
				);

			await logActivities(
				tasks.map((task) => ({
					organizationId: ctx.organization.id,
					buildId: task.buildId,
					buildTaskId: task.id,
					actorId: ctx.user.id,
					action: ActivityAction.taskUnassigned,
					metadata: { userId: input.userId, role: input.role ?? null },
				})),
			);

			return { unassigned: taskIds.length };
		}),

	/**
	 * Grid of template tasks (rows) × open projects (columns) of a template,
	 * each cell being the concrete build task with its assignees and status.
	 * Powers the cross-project assignment screen.
	 */
	assignmentGrid: protectedOrganizationProcedure
		.input(assignmentGridSchema)
		.query(async ({ ctx, input }) => {
			await getOwnedTemplate(input.templateId, ctx.organization.id);

			const buildConditions = [
				eq(buildTable.organizationId, ctx.organization.id),
				inArray(buildTable.templateVersionId, versionIdsOf(input.templateId)),
			];
			if (input.buildIds && input.buildIds.length > 0) {
				buildConditions.push(inArray(buildTable.id, input.buildIds));
			} else if (!input.includeCompleted) {
				buildConditions.push(inArray(buildTable.status, OPEN_BUILD_STATUSES));
			} else {
				buildConditions.push(ne(buildTable.status, BuildStatus.archived));
			}

			const builds = await db.query.buildTable.findMany({
				where: and(...buildConditions),
				orderBy: [
					asc(buildTable.plannedStartDate),
					asc(buildTable.serialNumber),
				],
				columns: {
					id: true,
					serialNumber: true,
					name: true,
					status: true,
					plannedStartDate: true,
					templateVersionId: true,
				},
			});

			if (builds.length === 0) return { builds: [], rows: [] };

			const tasks = await db.query.buildTaskTable.findMany({
				where: inArray(
					buildTaskTable.buildId,
					builds.map((build) => build.id),
				),
				orderBy: [asc(buildTaskTable.sortOrder), asc(buildTaskTable.title)],
				with: {
					assignments: {
						with: { user: { columns: { id: true, name: true, image: true } } },
					},
					parent: { columns: { title: true, sortOrder: true } },
				},
			});

			// Subtasks read "Parent › Subtask" and sort right behind their parent.
			const rowTitle = (task: (typeof tasks)[number]) =>
				task.parent ? `${task.parent.title} › ${task.title}` : task.title;
			const rowSort = (task: (typeof tasks)[number]) =>
				task.parent
					? task.parent.sortOrder + (task.sortOrder + 1) / 1000
					: task.sortOrder;

			// Group by template task when available so the same task lines up across
			// builds even if the planner renamed it on one build. Ad-hoc tasks (no
			// source) group by title.
			type Row = {
				key: string;
				title: string;
				phase: string | null;
				sortOrder: number;
				cells: Record<string, (typeof tasks)[number] | null>;
			};
			const rows = new Map<string, Row>();

			for (const task of tasks) {
				const key = task.sourceTemplateTaskId
					? `tpl:${task.sourceTemplateTaskId}`
					: `title:${rowTitle(task).toLowerCase()}`;
				let row = rows.get(key);
				if (!row) {
					row = {
						key,
						title: rowTitle(task),
						phase: task.phase,
						sortOrder: rowSort(task),
						cells: Object.fromEntries(builds.map((build) => [build.id, null])),
					};
					rows.set(key, row);
				}
				row.cells[task.buildId] = task;
			}

			// Builds may run on different template versions; merge rows that share
			// a task lineage (falling back to title) so the grid stays compact.
			const sourceIds = tasks
				.map((task) => task.sourceTemplateTaskId)
				.filter((id): id is string => Boolean(id));
			if (sourceIds.length > 0) {
				const sourceTasks = await db.query.templateTaskTable.findMany({
					where: inArray(templateTaskTable.id, Array.from(new Set(sourceIds))),
					columns: { id: true, lineageId: true },
				});
				const lineageBySource = new Map(
					sourceTasks.map((task) => [task.id, task.lineageId]),
				);
				const merged = new Map<string, Row>();
				for (const row of rows.values()) {
					const sourceId = row.key.startsWith("tpl:") ? row.key.slice(4) : null;
					const lineage = sourceId ? lineageBySource.get(sourceId) : null;
					const mergeKey = lineage
						? `lineage:${lineage}`
						: `title:${row.title.toLowerCase()}`;
					const existing = merged.get(mergeKey);
					if (!existing) {
						merged.set(mergeKey, { ...row, key: mergeKey });
						continue;
					}
					for (const [buildId, cell] of Object.entries(row.cells)) {
						if (cell && !existing.cells[buildId])
							existing.cells[buildId] = cell;
					}
					existing.sortOrder = Math.min(existing.sortOrder, row.sortOrder);
				}
				return {
					builds,
					rows: Array.from(merged.values()).sort(
						(a, b) =>
							a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
					),
				};
			}

			return {
				builds,
				rows: Array.from(rows.values()).sort(
					(a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
				),
			};
		}),

	// -------------------------------------------------------------------------
	// Overview
	// -------------------------------------------------------------------------

	overview: protectedOrganizationProcedure.query(async ({ ctx }) => {
		const [buildStats] = await db
			.select({
				total: sql<number>`count(*)::int`,
				planned: sql<number>`count(*) filter (where ${buildTable.status} = ${BuildStatus.planned})::int`,
				active: sql<number>`count(*) filter (where ${buildTable.status} = ${BuildStatus.active})::int`,
				blocked: sql<number>`count(*) filter (where ${buildTable.status} = ${BuildStatus.blocked})::int`,
				completed: sql<number>`count(*) filter (where ${buildTable.status} = ${BuildStatus.completed})::int`,
			})
			.from(buildTable)
			.where(
				and(
					eq(buildTable.organizationId, ctx.organization.id),
					isNull(buildTable.ownerUserId),
					ne(buildTable.status, BuildStatus.archived),
				),
			);

		const [taskStats] = await db
			.select({
				total: sql<number>`count(*)::int`,
				todo: sql<number>`count(*) filter (where ${buildTaskTable.status} = ${BuildTaskStatus.todo})::int`,
				inProgress: sql<number>`count(*) filter (where ${buildTaskTable.status} = ${BuildTaskStatus.inProgress})::int`,
				blocked: sql<number>`count(*) filter (where ${buildTaskTable.status} = ${BuildTaskStatus.blocked})::int`,
				review: sql<number>`count(*) filter (where ${buildTaskTable.status} = ${BuildTaskStatus.review})::int`,
				done: sql<number>`count(*) filter (where ${buildTaskTable.status} = ${BuildTaskStatus.done})::int`,
				unassigned: sql<number>`count(*) filter (where ${buildTaskTable.status} <> ${BuildTaskStatus.done} and not exists (select 1 from ${buildTaskAssignmentTable} a where a.build_task_id = ${buildTaskTable.id}))::int`,
			})
			.from(buildTaskTable)
			.innerJoin(buildTable, eq(buildTaskTable.buildId, buildTable.id))
			.where(
				and(
					eq(buildTaskTable.organizationId, ctx.organization.id),
					isNull(buildTable.ownerUserId),
					inArray(buildTable.status, OPEN_BUILD_STATUSES),
				),
			);

		const recentComments = await db.query.buildTaskCommentTable.findMany({
			where: inArray(
				buildTaskCommentTable.buildTaskId,
				db
					.select({ id: buildTaskTable.id })
					.from(buildTaskTable)
					.where(eq(buildTaskTable.organizationId, ctx.organization.id)),
			),
			orderBy: desc(buildTaskCommentTable.createdAt),
			limit: 10,
			with: {
				author: { columns: { id: true, name: true, image: true } },
				buildTask: {
					columns: { id: true, title: true, buildId: true },
					with: { build: { columns: { id: true, serialNumber: true } } },
				},
			},
		});

		// Aggregates always return exactly one row; the fallbacks only satisfy the type.
		return {
			builds: buildStats ?? {
				total: 0,
				planned: 0,
				active: 0,
				blocked: 0,
				completed: 0,
			},
			tasks: taskStats ?? {
				total: 0,
				todo: 0,
				inProgress: 0,
				blocked: 0,
				review: 0,
				done: 0,
				unassigned: 0,
			},
			recentComments,
		};
	}),
});
