import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { recordRevision } from "@/lib/db/revision";
import {
	BuildStatus,
	BuildTaskStatus,
	RevisionAction,
	RevisionEntity,
} from "@/lib/db/schema/enums";
import {
	buildTable,
	buildTaskAssignmentTable,
	buildTaskCommentTable,
	buildTaskTable,
	templateTaskTable,
} from "@/lib/db/schema/manufacturing-tables";
import { memberTable, userTable } from "@/lib/db/schema/tables";
import {
	ActivityAction,
	logActivities,
	logActivity,
} from "@/lib/manufacturing/activity";
import {
	createBuildFromVersion,
	getOwnedBuild,
	getOwnedBuildTask,
	getOwnedBuildTasks,
	getOwnedProduct,
} from "@/lib/manufacturing/builds";
import { assertCanPlan } from "@/lib/manufacturing/permissions";
import { toDateString } from "@/lib/manufacturing/scheduling";
import {
	assignBuildTasksSchema,
	assignmentGridSchema,
	createBuildSchema,
	createBuildTaskSchema,
	deleteBuildSchema,
	deleteBuildTaskSchema,
	getBuildSchema,
	listBuildsSchema,
	unassignBuildTasksSchema,
	updateBuildSchema,
	updateBuildTaskSchema,
} from "@/schemas/manufacturing-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

const OPEN_BUILD_STATUSES = [
	BuildStatus.planned,
	BuildStatus.active,
	BuildStatus.blocked,
];

export const organizationBuildRouter = createTRPCRouter({
	list: protectedOrganizationProcedure
		.input(listBuildsSchema)
		.query(async ({ ctx, input }) => {
			const conditions = [eq(buildTable.organizationId, ctx.organization.id)];
			if (input.productId) {
				conditions.push(eq(buildTable.productId, input.productId));
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
					templateVersion: { columns: { id: true, versionNumber: true } },
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

			return {
				...build,
				tasks: build.tasks.map((task) => ({
					...task,
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
					eq(buildTable.productId, input.productId),
					eq(buildTable.serialNumber, input.serialNumber),
				),
				columns: { id: true },
			});
			if (duplicate) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "A build with this serial number already exists.",
				});
			}

			const build = await createBuildFromVersion({
				organizationId: ctx.organization.id,
				userId: ctx.user.id,
				productId: input.productId,
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

	createTask: protectedOrganizationProcedure
		.input(createBuildTaskSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const build = await getOwnedBuild(input.buildId, ctx.organization.id);

			const [sortRow] = await db
				.select({ maxSort: sql<number>`coalesce(max(sort_order), -1)::int` })
				.from(buildTaskTable)
				.where(eq(buildTaskTable.buildId, build.id));
			const maxSort = sortRow?.maxSort ?? -1;

			const startDate =
				input.startDate ?? build.plannedStartDate ?? toDateString(new Date());
			const end = new Date(`${startDate}T00:00:00.000Z`);
			end.setUTCDate(end.getUTCDate() + input.plannedDurationDays);

			const [task] = await db
				.insert(buildTaskTable)
				.values({
					organizationId: ctx.organization.id,
					buildId: build.id,
					title: input.title,
					instructions: input.instructions ?? null,
					phase: input.phase ?? null,
					sortOrder: maxSort + 1,
					plannedDurationDays: input.plannedDurationDays,
					startDate,
					endDate: toDateString(end),
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
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedBuildTask(input.id, ctx.organization.id);

			const { id, ...changes } = input;
			const [after] = await db
				.update(buildTaskTable)
				.set(
					Object.fromEntries(
						Object.entries(changes).filter(([, value]) => value !== undefined),
					),
				)
				.where(eq(buildTaskTable.id, id))
				.returning();

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.buildTask,
				entityId: id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
			});

			return after;
		}),

	deleteTask: protectedOrganizationProcedure
		.input(deleteBuildTaskSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedBuildTask(input.id, ctx.organization.id);

			if (before.status !== BuildTaskStatus.todo) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only tasks that have not been started can be deleted.",
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
	 * Grid of template tasks (rows) × open builds (columns) for a product, each
	 * cell being the concrete build task with its assignees and status. Powers
	 * the cross-build assignment screen.
	 */
	assignmentGrid: protectedOrganizationProcedure
		.input(assignmentGridSchema)
		.query(async ({ ctx, input }) => {
			await getOwnedProduct(input.productId, ctx.organization.id);

			const buildConditions = [
				eq(buildTable.organizationId, ctx.organization.id),
				eq(buildTable.productId, input.productId),
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
				},
			});

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
					: `title:${task.title.toLowerCase()}`;
				let row = rows.get(key);
				if (!row) {
					row = {
						key,
						title: task.title,
						phase: task.phase,
						sortOrder: task.sortOrder,
						cells: Object.fromEntries(builds.map((build) => [build.id, null])),
					};
					rows.set(key, row);
				}
				row.cells[task.buildId] = task;
			}

			// Template tasks may differ between versions; merge rows with the same
			// title from different versions so the grid stays compact.
			const sourceIds = tasks
				.map((task) => task.sourceTemplateTaskId)
				.filter((id): id is string => Boolean(id));
			if (sourceIds.length > 0) {
				const sourceTasks = await db.query.templateTaskTable.findMany({
					where: inArray(templateTaskTable.id, Array.from(new Set(sourceIds))),
					columns: { id: true, title: true },
				});
				const titleBySource = new Map(
					sourceTasks.map((task) => [task.id, task.title.toLowerCase()]),
				);
				const merged = new Map<string, Row>();
				for (const row of rows.values()) {
					const sourceId = row.key.startsWith("tpl:") ? row.key.slice(4) : null;
					const mergeKey = sourceId
						? `title:${titleBySource.get(sourceId) ?? row.title.toLowerCase()}`
						: row.key;
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
