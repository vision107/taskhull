import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
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
import { latestEndDate, scheduleTasks } from "@/lib/manufacturing/scheduling";
import { getLatestPublishedVersion } from "@/lib/manufacturing/template-versions";

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
	productId: string;
	templateVersionId?: string;
	serialNumber: string;
	name?: string;
	description?: string;
	plannedStartDate: string;
}

/**
 * Create a build for a product and copy the tasks of a published template
 * version onto it: tasks, checklist items, dependencies and documents. Tasks
 * are forward-scheduled from the planned start date.
 *
 * Nothing is assigned yet — planners assign afterwards, typically across many
 * builds at once.
 */
export async function createBuildFromVersion(
	params: CreateBuildParams,
): Promise<Build> {
	const product = await getOwnedProduct(
		params.productId,
		params.organizationId,
	);

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
	} else if (product.templateId) {
		version = await getLatestPublishedVersion(product.templateId);
		if (!version) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"The product's template has no published version yet. Publish one first.",
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
				productId: product.id,
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
