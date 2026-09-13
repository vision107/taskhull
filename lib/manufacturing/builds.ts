import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
	AttachmentKind,
	BuildStatus,
	BuildTaskStatus,
	TemplateVersionStatus,
} from "@/lib/db/schema/enums";
import {
	buildTable,
	buildTaskAttachmentTable,
	buildTaskChecklistItemTable,
	buildTaskDependencyTable,
	buildTaskTable,
	productTable,
	templateTaskChecklistItemTable,
	templateTaskTable,
	templateVersionTable,
} from "@/lib/db/schema/manufacturing-tables";
import { ActivityAction, logActivity } from "@/lib/manufacturing/activity";
import {
	latestEndDate,
	scheduleTasks,
	toDateString,
} from "@/lib/manufacturing/scheduling";
import {
	getLatestPublishedVersion,
	getOwnedTemplate,
} from "@/lib/manufacturing/template-versions";

export type Build = typeof buildTable.$inferSelect;
export type BuildTask = typeof buildTaskTable.$inferSelect;

export async function getOwnedProduct(
	productId: string,
	organizationId: string,
) {
	const product = await db.query.productTable.findFirst({
		where: and(
			eq(productTable.id, productId),
			eq(productTable.organizationId, organizationId),
		),
	});

	if (!product) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Product not found." });
	}

	return product;
}

export async function getOwnedBuild(buildId: string, organizationId: string) {
	const build = await db.query.buildTable.findFirst({
		where: and(
			eq(buildTable.id, buildId),
			eq(buildTable.organizationId, organizationId),
		),
	});

	if (!build) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Build not found." });
	}

	return build;
}

export async function getOwnedBuildTask(
	buildTaskId: string,
	organizationId: string,
) {
	const task = await db.query.buildTaskTable.findFirst({
		where: and(
			eq(buildTaskTable.id, buildTaskId),
			eq(buildTaskTable.organizationId, organizationId),
		),
	});

	if (!task) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
	}

	return task;
}

/**
 * Load several build tasks and verify all belong to the organization.
 */
export async function getOwnedBuildTasks(
	buildTaskIds: string[],
	organizationId: string,
): Promise<BuildTask[]> {
	const unique = Array.from(new Set(buildTaskIds));
	if (unique.length === 0) return [];

	const tasks = await db.query.buildTaskTable.findMany({
		where: and(
			inArray(buildTaskTable.id, unique),
			eq(buildTaskTable.organizationId, organizationId),
		),
	});

	if (tasks.length !== unique.length) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "One or more tasks were not found.",
		});
	}

	return tasks;
}

interface CreateBuildParams {
	organizationId: string;
	userId: string;
	/** Legacy grouping, optional. */
	productId?: string;
	/** Exact version to copy from. */
	templateVersionId?: string;
	/** Latest published version of this template (ignored when a version is given). */
	templateId?: string;
	serialNumber: string;
	name?: string;
	description?: string;
	plannedStartDate: string;
}

/**
 * Create a project (build). When a template or version is given, its tasks,
 * checklist items, dependencies and documents are copied onto the project and
 * forward-scheduled from the planned start date. Without one the project
 * starts blank and the planner adds tasks by hand.
 *
 * Nothing is assigned yet — planners assign afterwards, typically across many
 * projects at once.
 */
export async function createBuildFromVersion(
	params: CreateBuildParams,
): Promise<Build> {
	const product = params.productId
		? await getOwnedProduct(params.productId, params.organizationId)
		: null;

	let version: typeof templateVersionTable.$inferSelect | undefined;

	if (params.templateVersionId) {
		const found = await db.query.templateVersionTable.findFirst({
			where: eq(templateVersionTable.id, params.templateVersionId),
			with: { template: { columns: { organizationId: true } } },
		});
		if (!found || found.template.organizationId !== params.organizationId) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Template version not found.",
			});
		}
		const { template: _template, ...rest } = found;
		version = rest;
		if (version.status !== TemplateVersionStatus.published) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Only published template versions can be used for builds.",
			});
		}
	} else if (params.templateId ?? product?.templateId) {
		const templateId = (params.templateId ?? product?.templateId) as string;
		await getOwnedTemplate(templateId, params.organizationId);
		version = await getLatestPublishedVersion(templateId);
		if (!version) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"This template has no published version yet. Publish one first.",
			});
		}
	}

	const templateTasks = version
		? await db.query.templateTaskTable.findMany({
				where: eq(templateTaskTable.versionId, version.id),
				orderBy: asc(templateTaskTable.sortOrder),
				with: {
					checklistItems: {
						orderBy: asc(templateTaskChecklistItemTable.sortOrder),
					},
					documents: true,
					dependencies: true,
				},
			})
		: [];

	const schedule = scheduleTasks(
		templateTasks.map((task) => ({
			id: task.id,
			durationDays: task.durationDays,
			dependsOn: task.dependencies.map((dep) => dep.dependsOnTemplateTaskId),
		})),
		params.plannedStartDate,
	);
	const scheduleById = new Map(schedule.map((entry) => [entry.id, entry]));
	const plannedEndDate = latestEndDate(schedule) ?? params.plannedStartDate;

	const build = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(buildTable)
			.values({
				organizationId: params.organizationId,
				productId: product?.id ?? null,
				templateVersionId: version?.id ?? null,
				serialNumber: params.serialNumber,
				name: params.name || null,
				description: params.description || null,
				status: BuildStatus.planned,
				plannedStartDate: params.plannedStartDate,
				plannedEndDate,
				createdById: params.userId,
			})
			.returning();

		if (!created) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create build.",
			});
		}

		const templateToBuildTaskId = new Map<string, string>();

		for (const templateTask of templateTasks) {
			const dates = scheduleById.get(templateTask.id);
			const [buildTask] = await tx
				.insert(buildTaskTable)
				.values({
					organizationId: params.organizationId,
					buildId: created.id,
					sourceTemplateTaskId: templateTask.id,
					title: templateTask.title,
					instructions: templateTask.instructions,
					phase: templateTask.phase,
					sortOrder: templateTask.sortOrder,
					plannedDurationDays: templateTask.durationDays,
					plannedHours: templateTask.plannedHours,
					startDate: dates?.startDate ?? params.plannedStartDate,
					endDate: dates?.endDate ?? params.plannedStartDate,
					status: BuildTaskStatus.todo,
					requiresPhoto: templateTask.requiresPhoto,
					requiresComment: templateTask.requiresComment,
				})
				.returning({ id: buildTaskTable.id });

			if (!buildTask) continue;
			templateToBuildTaskId.set(templateTask.id, buildTask.id);

			if (templateTask.checklistItems.length > 0) {
				await tx.insert(buildTaskChecklistItemTable).values(
					templateTask.checklistItems.map((item) => ({
						buildTaskId: buildTask.id,
						title: item.title,
						sortOrder: item.sortOrder,
					})),
				);
			}

			if (templateTask.documents.length > 0) {
				await tx.insert(buildTaskAttachmentTable).values(
					templateTask.documents.map((doc) => ({
						buildTaskId: buildTask.id,
						kind: AttachmentKind.document,
						templateDocumentId: doc.id,
						uploadedById: doc.uploadedById,
						storageKey: doc.storageKey,
						fileName: doc.fileName,
						contentType: doc.contentType,
						sizeBytes: doc.sizeBytes,
					})),
				);
			}
		}

		await linkSubtasks(tx, templateTasks, templateToBuildTaskId);

		const dependencyRows = templateTasks.flatMap((templateTask) =>
			templateTask.dependencies.flatMap((dep) => {
				const buildTaskId = templateToBuildTaskId.get(templateTask.id);
				const dependsOnBuildTaskId = templateToBuildTaskId.get(
					dep.dependsOnTemplateTaskId,
				);
				if (!(buildTaskId && dependsOnBuildTaskId)) return [];
				return [{ buildTaskId, dependsOnBuildTaskId }];
			}),
		);

		if (dependencyRows.length > 0) {
			await tx
				.insert(buildTaskDependencyTable)
				.values(dependencyRows)
				.onConflictDoNothing();
		}

		return created;
	});

	await logActivity({
		organizationId: params.organizationId,
		buildId: build.id,
		actorId: params.userId,
		action: ActivityAction.buildCreated,
		metadata: {
			serialNumber: build.serialNumber,
			templateVersionId: version?.id ?? null,
			taskCount: templateTasks.length,
		},
	});

	return build;
}

/**
 * Keep the build's status in sync with its tasks: first task started ->
 * active; all tasks done -> completed. Never overrides `archived`.
 */
export async function syncBuildStatus(buildId: string): Promise<void> {
	const build = await db.query.buildTable.findFirst({
		where: eq(buildTable.id, buildId),
		columns: { id: true, status: true, actualStartedAt: true },
	});
	if (!build || build.status === BuildStatus.archived) return;

	const tasks = await db.query.buildTaskTable.findMany({
		where: eq(buildTaskTable.buildId, buildId),
		columns: { status: true },
	});
	if (tasks.length === 0) return;

	const allDone = tasks.every((task) => task.status === BuildTaskStatus.done);
	const anyBlocked = tasks.some(
		(task) => task.status === BuildTaskStatus.blocked,
	);
	const anyStarted = tasks.some((task) => task.status !== BuildTaskStatus.todo);

	let nextStatus: BuildStatus = build.status;
	if (allDone) nextStatus = BuildStatus.completed;
	else if (anyBlocked) nextStatus = BuildStatus.blocked;
	else if (anyStarted) nextStatus = BuildStatus.active;
	else nextStatus = BuildStatus.planned;

	if (nextStatus === build.status) return;

	await db
		.update(buildTable)
		.set({
			status: nextStatus,
			actualStartedAt:
				anyStarted && !build.actualStartedAt
					? new Date()
					: build.actualStartedAt,
			actualCompletedAt: allDone ? new Date() : null,
		})
		.where(eq(buildTable.id, buildId));
}

/**
 * Dependencies of a build task that are not done yet.
 */
export async function getOpenBlockers(buildTaskId: string) {
	const deps = await db.query.buildTaskDependencyTable.findMany({
		where: eq(buildTaskDependencyTable.buildTaskId, buildTaskId),
		with: {
			dependsOn: { columns: { id: true, title: true, status: true } },
		},
	});
	return deps
		.map((dep) => dep.dependsOn)
		.filter((task) => task.status !== BuildTaskStatus.done);
}

// ---------------------------------------------------------------------------
// Upgrade a build to a newer template version
// ---------------------------------------------------------------------------

export interface UpgradeBuildResult {
	added: number;
	updated: number;
	removed: number;
	kept: number;
	fromVersionNumber: number | null;
	toVersionNumber: number;
}

/**
 * Published versions of the build's template that are newer than the one the
 * build was created from. Empty when the build is up to date or ad-hoc.
 */
export async function getAvailableUpgrades(build: Build) {
	if (!build.templateVersionId) return [];

	const current = await db.query.templateVersionTable.findFirst({
		where: eq(templateVersionTable.id, build.templateVersionId),
		columns: { id: true, templateId: true, versionNumber: true },
	});
	if (!current) return [];

	const rows = await db.query.templateVersionTable.findMany({
		where: and(
			eq(templateVersionTable.templateId, current.templateId),
			eq(templateVersionTable.status, TemplateVersionStatus.published),
		),
		orderBy: desc(templateVersionTable.versionNumber),
		columns: {
			id: true,
			versionNumber: true,
			changeNote: true,
			publishedAt: true,
		},
	});

	return rows.filter((row) => row.versionNumber > current.versionNumber);
}

/**
 * Re-point a build at a newer published version of its template and merge the
 * task list:
 *
 * - Tasks that still exist in the new version (same lineage) are updated in
 *   place: title, instructions, phase, order, duration, flags. Status,
 *   assignments, comments and photos are untouched. Finished tasks only get
 *   their source pointer updated.
 * - Tasks the new version added are created (todo, unassigned).
 * - Tasks the new version dropped are deleted if nobody touched them
 *   (todo, no assignees, comments or uploads); otherwise they are kept as
 *   ad-hoc tasks so no work is lost.
 * - Checklists of unfinished tasks are merged by title (checked items stay).
 * - Template documents are synced; worker uploads stay.
 * - Dependencies between template tasks are rebuilt from the new version;
 *   dependencies involving ad-hoc tasks are preserved.
 * - Unfinished tasks are rescheduled from the build's planned start date.
 */
export async function upgradeBuildToVersion(params: {
	organizationId: string;
	userId: string;
	buildId: string;
	templateVersionId: string;
}): Promise<UpgradeBuildResult> {
	const build = await getOwnedBuild(params.buildId, params.organizationId);
	if (
		build.status === BuildStatus.completed ||
		build.status === BuildStatus.archived
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Completed or archived builds cannot be upgraded.",
		});
	}
	if (build.templateVersionId === params.templateVersionId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The build already uses this version.",
		});
	}

	const target = await db.query.templateVersionTable.findFirst({
		where: eq(templateVersionTable.id, params.templateVersionId),
		with: { template: { columns: { id: true, organizationId: true } } },
	});
	if (!target || target.template.organizationId !== params.organizationId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Template version not found.",
		});
	}
	if (target.status !== TemplateVersionStatus.published) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Only published versions can be applied to a build.",
		});
	}

	const current = build.templateVersionId
		? await db.query.templateVersionTable.findFirst({
				where: eq(templateVersionTable.id, build.templateVersionId),
				columns: { id: true, templateId: true, versionNumber: true },
			})
		: null;
	if (current && current.templateId !== target.template.id) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The version belongs to a different template.",
		});
	}

	const [existingTasks, newTemplateTasks] = await Promise.all([
		db.query.buildTaskTable.findMany({
			where: eq(buildTaskTable.buildId, build.id),
			with: {
				sourceTemplateTask: { columns: { id: true, lineageId: true } },
				assignments: { columns: { id: true } },
				comments: { columns: { id: true } },
				attachments: {
					columns: { id: true, templateDocumentId: true, storageKey: true },
				},
				checklistItems: true,
				dependencies: { columns: { dependsOnBuildTaskId: true } },
			},
		}),
		db.query.templateTaskTable.findMany({
			where: eq(templateTaskTable.versionId, target.id),
			orderBy: asc(templateTaskTable.sortOrder),
			with: {
				checklistItems: {
					orderBy: asc(templateTaskChecklistItemTable.sortOrder),
				},
				documents: true,
				dependencies: true,
			},
		}),
	]);

	const existingByLineage = new Map<string, (typeof existingTasks)[number]>();
	for (const task of existingTasks) {
		const lineage = task.sourceTemplateTask?.lineageId;
		if (lineage && !existingByLineage.has(lineage)) {
			existingByLineage.set(lineage, task);
		}
	}

	const result: UpgradeBuildResult = {
		added: 0,
		updated: 0,
		removed: 0,
		kept: 0,
		fromVersionNumber: current?.versionNumber ?? null,
		toVersionNumber: target.versionNumber,
	};

	await db.transaction(async (tx) => {
		// Template task id (new version) -> build task id
		const templateToBuildTaskId = new Map<string, string>();
		const matchedBuildTaskIds = new Set<string>();

		for (const templateTask of newTemplateTasks) {
			const existing = existingByLineage.get(templateTask.lineageId);

			if (existing) {
				matchedBuildTaskIds.add(existing.id);
				templateToBuildTaskId.set(templateTask.id, existing.id);
				const finished = existing.status === BuildTaskStatus.done;

				await tx
					.update(buildTaskTable)
					.set(
						finished
							? { sourceTemplateTaskId: templateTask.id }
							: {
									sourceTemplateTaskId: templateTask.id,
									title: templateTask.title,
									instructions: templateTask.instructions,
									phase: templateTask.phase,
									sortOrder: templateTask.sortOrder,
									plannedDurationDays: templateTask.durationDays,
									plannedHours: templateTask.plannedHours,
									requiresPhoto: templateTask.requiresPhoto,
									requiresComment: templateTask.requiresComment,
								},
					)
					.where(eq(buildTaskTable.id, existing.id));
				result.updated++;

				if (!finished) {
					// Checklist: merge by title, keep anything already ticked.
					const wanted = new Map(
						templateTask.checklistItems.map((item) => [
							item.title.trim().toLowerCase(),
							item,
						]),
					);
					const present = new Set<string>();
					for (const item of existing.checklistItems) {
						const key = item.title.trim().toLowerCase();
						const target = wanted.get(key);
						if (target) {
							present.add(key);
							if (item.sortOrder !== target.sortOrder) {
								await tx
									.update(buildTaskChecklistItemTable)
									.set({ sortOrder: target.sortOrder })
									.where(eq(buildTaskChecklistItemTable.id, item.id));
							}
						} else if (item.status === "open") {
							await tx
								.delete(buildTaskChecklistItemTable)
								.where(eq(buildTaskChecklistItemTable.id, item.id));
						}
					}
					const missing = templateTask.checklistItems.filter(
						(item) => !present.has(item.title.trim().toLowerCase()),
					);
					if (missing.length > 0) {
						await tx.insert(buildTaskChecklistItemTable).values(
							missing.map((item) => ({
								buildTaskId: existing.id,
								title: item.title,
								sortOrder: item.sortOrder,
							})),
						);
					}
				}

				// Template documents: sync by storage key; worker uploads untouched.
				const haveKeys = new Set(
					existing.attachments
						.filter((att) => att.templateDocumentId)
						.map((att) => att.storageKey),
				);
				const wantKeys = new Set(
					templateTask.documents.map((d) => d.storageKey),
				);
				const staleDocIds = existing.attachments
					.filter(
						(att) => att.templateDocumentId && !wantKeys.has(att.storageKey),
					)
					.map((att) => att.id);
				if (staleDocIds.length > 0) {
					await tx
						.delete(buildTaskAttachmentTable)
						.where(inArray(buildTaskAttachmentTable.id, staleDocIds));
				}
				const newDocs = templateTask.documents.filter(
					(doc) => !haveKeys.has(doc.storageKey),
				);
				if (newDocs.length > 0) {
					await tx.insert(buildTaskAttachmentTable).values(
						newDocs.map((doc) => ({
							buildTaskId: existing.id,
							kind: AttachmentKind.document,
							templateDocumentId: doc.id,
							uploadedById: doc.uploadedById,
							storageKey: doc.storageKey,
							fileName: doc.fileName,
							contentType: doc.contentType,
							sizeBytes: doc.sizeBytes,
						})),
					);
				}
				continue;
			}

			// Brand new task in this version.
			const [created] = await tx
				.insert(buildTaskTable)
				.values({
					organizationId: params.organizationId,
					buildId: build.id,
					sourceTemplateTaskId: templateTask.id,
					title: templateTask.title,
					instructions: templateTask.instructions,
					phase: templateTask.phase,
					sortOrder: templateTask.sortOrder,
					plannedDurationDays: templateTask.durationDays,
					plannedHours: templateTask.plannedHours,
					startDate: build.plannedStartDate ?? toDateString(new Date()),
					endDate: build.plannedStartDate ?? toDateString(new Date()),
					status: BuildTaskStatus.todo,
					requiresPhoto: templateTask.requiresPhoto,
					requiresComment: templateTask.requiresComment,
				})
				.returning({ id: buildTaskTable.id });
			if (!created) continue;
			result.added++;
			templateToBuildTaskId.set(templateTask.id, created.id);
			matchedBuildTaskIds.add(created.id);

			if (templateTask.checklistItems.length > 0) {
				await tx.insert(buildTaskChecklistItemTable).values(
					templateTask.checklistItems.map((item) => ({
						buildTaskId: created.id,
						title: item.title,
						sortOrder: item.sortOrder,
					})),
				);
			}
			if (templateTask.documents.length > 0) {
				await tx.insert(buildTaskAttachmentTable).values(
					templateTask.documents.map((doc) => ({
						buildTaskId: created.id,
						kind: AttachmentKind.document,
						templateDocumentId: doc.id,
						uploadedById: doc.uploadedById,
						storageKey: doc.storageKey,
						fileName: doc.fileName,
						contentType: doc.contentType,
						sizeBytes: doc.sizeBytes,
					})),
				);
			}
		}

		// Template-derived tasks that no longer exist in the new version.
		const orphaned = existingTasks.filter(
			(task) => task.sourceTemplateTaskId && !matchedBuildTaskIds.has(task.id),
		);
		for (const task of orphaned) {
			const untouched =
				task.status === BuildTaskStatus.todo &&
				task.assignments.length === 0 &&
				task.comments.length === 0 &&
				task.attachments.every((att) => att.templateDocumentId);
			if (untouched) {
				await tx.delete(buildTaskTable).where(eq(buildTaskTable.id, task.id));
				result.removed++;
			} else {
				await tx
					.update(buildTaskTable)
					.set({ sourceTemplateTaskId: null })
					.where(eq(buildTaskTable.id, task.id));
				result.kept++;
			}
		}

		// Subtask structure follows the template for every template-derived task.
		await linkSubtasks(tx, newTemplateTasks, templateToBuildTaskId);

		// Dependencies: rebuild the template-derived ones, keep ad-hoc edges.
		const templateBuildTaskIds = Array.from(templateToBuildTaskId.values());
		if (templateBuildTaskIds.length > 0) {
			await tx
				.delete(buildTaskDependencyTable)
				.where(
					and(
						inArray(buildTaskDependencyTable.buildTaskId, templateBuildTaskIds),
						inArray(
							buildTaskDependencyTable.dependsOnBuildTaskId,
							templateBuildTaskIds,
						),
					),
				);
		}
		const dependencyRows = newTemplateTasks.flatMap((templateTask) =>
			templateTask.dependencies.flatMap((dep) => {
				const buildTaskId = templateToBuildTaskId.get(templateTask.id);
				const dependsOnBuildTaskId = templateToBuildTaskId.get(
					dep.dependsOnTemplateTaskId,
				);
				if (!(buildTaskId && dependsOnBuildTaskId)) return [];
				return [{ buildTaskId, dependsOnBuildTaskId }];
			}),
		);
		if (dependencyRows.length > 0) {
			await tx
				.insert(buildTaskDependencyTable)
				.values(dependencyRows)
				.onConflictDoNothing();
		}

		// Reschedule unfinished tasks from the planned start.
		const tasksNow = await tx.query.buildTaskTable.findMany({
			where: eq(buildTaskTable.buildId, build.id),
			columns: {
				id: true,
				status: true,
				plannedDurationDays: true,
				startDate: true,
				endDate: true,
			},
			with: { dependencies: { columns: { dependsOnBuildTaskId: true } } },
		});
		const scheduleStart = build.plannedStartDate ?? toDateString(new Date());
		const schedule = scheduleTasks(
			tasksNow.map((task) => ({
				id: task.id,
				durationDays: task.plannedDurationDays,
				dependsOn: task.dependencies.map((dep) => dep.dependsOnBuildTaskId),
			})),
			scheduleStart,
		);
		for (const entry of schedule) {
			const task = tasksNow.find((t) => t.id === entry.id);
			if (!task || task.status === BuildTaskStatus.done) continue;
			if (task.startDate === entry.startDate && task.endDate === entry.endDate)
				continue;
			await tx
				.update(buildTaskTable)
				.set({ startDate: entry.startDate, endDate: entry.endDate })
				.where(eq(buildTaskTable.id, task.id));
		}

		await tx
			.update(buildTable)
			.set({
				templateVersionId: target.id,
				plannedEndDate: latestEndDate(schedule) ?? build.plannedEndDate,
			})
			.where(eq(buildTable.id, build.id));
	});

	await Promise.all([
		logActivity({
			organizationId: params.organizationId,
			buildId: build.id,
			actorId: params.userId,
			action: ActivityAction.buildUpgraded,
			metadata: { ...result },
		}),
		syncBuildStatus(build.id),
	]);

	return result;
}

/**
 * Point build tasks at their parent build task, mirroring `parentTaskId` on
 * the template tasks they were created from. Parents that are not part of the
 * mapping (dropped from the template) leave the task at top level.
 */
async function linkSubtasks(
	tx: Pick<typeof db, "update">,
	templateTasks: { id: string; parentTaskId: string | null }[],
	templateToBuildTaskId: Map<string, string>,
): Promise<void> {
	for (const templateTask of templateTasks) {
		const buildTaskId = templateToBuildTaskId.get(templateTask.id);
		if (!buildTaskId) continue;
		const parentBuildTaskId = templateTask.parentTaskId
			? (templateToBuildTaskId.get(templateTask.parentTaskId) ?? null)
			: null;
		await tx
			.update(buildTaskTable)
			.set({ parentTaskId: parentBuildTaskId })
			.where(eq(buildTaskTable.id, buildTaskId));
	}
}
