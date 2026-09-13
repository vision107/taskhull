import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { TemplateVersionStatus } from "@/lib/db/schema/enums";
import {
	templateTable,
	templateTaskChecklistItemTable,
	templateTaskDependencyTable,
	templateTaskDocumentTable,
	templateTaskTable,
	templateVersionTable,
} from "@/lib/db/schema/manufacturing-tables";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Db | Tx;

export type TemplateVersion = typeof templateVersionTable.$inferSelect;
export type TemplateTask = typeof templateTaskTable.$inferSelect;

/**
 * Load a template and verify it belongs to the organization.
 */
export async function getOwnedTemplate(
	templateId: string,
	organizationId: string,
	executor: Executor = db,
) {
	const template = await executor.query.templateTable.findFirst({
		where: and(
			eq(templateTable.id, templateId),
			eq(templateTable.organizationId, organizationId),
		),
	});

	if (!template) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." });
	}

	return template;
}

/**
 * Load a version together with its template and verify tenant ownership.
 */
export async function getOwnedVersion(
	versionId: string,
	organizationId: string,
	executor: Executor = db,
) {
	const version = await executor.query.templateVersionTable.findFirst({
		where: eq(templateVersionTable.id, versionId),
		with: { template: true },
	});

	if (!version || version.template.organizationId !== organizationId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Template version not found.",
		});
	}

	return version;
}

/**
 * Like {@link getOwnedVersion} but additionally requires the version to be an
 * editable draft. Published/archived versions are immutable.
 */
export async function getOwnedDraftVersion(
	versionId: string,
	organizationId: string,
	executor: Executor = db,
) {
	const version = await getOwnedVersion(versionId, organizationId, executor);

	if (version.status !== TemplateVersionStatus.draft) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"This version is published and cannot be edited. Create a new draft instead.",
		});
	}

	return version;
}

/**
 * Load a template task, its version and template; verify tenant ownership and
 * that the version is still a draft.
 */
export async function getOwnedDraftTask(
	templateTaskId: string,
	organizationId: string,
	executor: Executor = db,
) {
	const task = await executor.query.templateTaskTable.findFirst({
		where: eq(templateTaskTable.id, templateTaskId),
		with: { version: { with: { template: true } } },
	});

	if (!task || task.version.template.organizationId !== organizationId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Template task not found.",
		});
	}

	if (task.version.status !== TemplateVersionStatus.draft) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This version is published and cannot be edited.",
		});
	}

	return task;
}

export async function getLatestPublishedVersion(
	templateId: string,
	executor: Executor = db,
): Promise<TemplateVersion | undefined> {
	return executor.query.templateVersionTable.findFirst({
		where: and(
			eq(templateVersionTable.templateId, templateId),
			eq(templateVersionTable.status, TemplateVersionStatus.published),
		),
		orderBy: desc(templateVersionTable.versionNumber),
	});
}

export async function getDraftVersion(
	templateId: string,
	executor: Executor = db,
): Promise<TemplateVersion | undefined> {
	return executor.query.templateVersionTable.findFirst({
		where: and(
			eq(templateVersionTable.templateId, templateId),
			eq(templateVersionTable.status, TemplateVersionStatus.draft),
		),
	});
}

/**
 * Deep-copy all tasks, checklist items, dependencies and documents from one
 * version into another (which must be empty). Returns a map of old task id ->
 * new task id.
 */
export async function copyVersionContents(
	fromVersionId: string,
	toVersionId: string,
	executor: Executor,
): Promise<Map<string, string>> {
	const idMap = new Map<string, string>();

	const tasks = await executor.query.templateTaskTable.findMany({
		where: eq(templateTaskTable.versionId, fromVersionId),
		orderBy: asc(templateTaskTable.sortOrder),
		with: {
			checklistItems: {
				orderBy: asc(templateTaskChecklistItemTable.sortOrder),
			},
			documents: true,
		},
	});

	if (tasks.length === 0) return idMap;

	for (const task of tasks) {
		const [created] = await executor
			.insert(templateTaskTable)
			.values({
				versionId: toVersionId,
				lineageId: task.lineageId,
				title: task.title,
				instructions: task.instructions,
				phase: task.phase,
				sortOrder: task.sortOrder,
				durationDays: task.durationDays,
				plannedHours: task.plannedHours,
				requiresPhoto: task.requiresPhoto,
				requiresComment: task.requiresComment,
			})
			.returning({ id: templateTaskTable.id });

		if (!created) continue;
		idMap.set(task.id, created.id);

		if (task.checklistItems.length > 0) {
			await executor.insert(templateTaskChecklistItemTable).values(
				task.checklistItems.map((item) => ({
					templateTaskId: created.id,
					title: item.title,
					sortOrder: item.sortOrder,
				})),
			);
		}

		if (task.documents.length > 0) {
			await executor.insert(templateTaskDocumentTable).values(
				task.documents.map((doc) => ({
					templateTaskId: created.id,
					uploadedById: doc.uploadedById,
					storageKey: doc.storageKey,
					fileName: doc.fileName,
					contentType: doc.contentType,
					sizeBytes: doc.sizeBytes,
				})),
			);
		}
	}

	const dependencies =
		await executor.query.templateTaskDependencyTable.findMany({
			where: inArray(
				templateTaskDependencyTable.templateTaskId,
				tasks.map((task) => task.id),
			),
		});

	const mappedDependencies = dependencies.flatMap((dep) => {
		const taskId = idMap.get(dep.templateTaskId);
		const dependsOnId = idMap.get(dep.dependsOnTemplateTaskId);
		if (!(taskId && dependsOnId)) return [];
		return [{ templateTaskId: taskId, dependsOnTemplateTaskId: dependsOnId }];
	});

	if (mappedDependencies.length > 0) {
		await executor
			.insert(templateTaskDependencyTable)
			.values(mappedDependencies)
			.onConflictDoNothing();
	}

	return idMap;
}

/**
 * Return the template's draft version, creating one if necessary. A new draft
 * is a deep copy of the latest published version (or empty for a brand new
 * template) with the next version number.
 */
export async function ensureDraftVersion(params: {
	templateId: string;
	organizationId: string;
	userId: string;
}): Promise<{ version: TemplateVersion; created: boolean }> {
	await getOwnedTemplate(params.templateId, params.organizationId);

	const existingDraft = await getDraftVersion(params.templateId);
	if (existingDraft) {
		return { version: existingDraft, created: false };
	}

	const version = await db.transaction(async (tx) => {
		const latest = await tx.query.templateVersionTable.findFirst({
			where: eq(templateVersionTable.templateId, params.templateId),
			orderBy: desc(templateVersionTable.versionNumber),
		});

		const latestPublished = await getLatestPublishedVersion(
			params.templateId,
			tx,
		);

		const [draft] = await tx
			.insert(templateVersionTable)
			.values({
				templateId: params.templateId,
				versionNumber: (latest?.versionNumber ?? 0) + 1,
				status: TemplateVersionStatus.draft,
				createdById: params.userId,
			})
			.returning();

		if (!draft) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create draft version.",
			});
		}

		if (latestPublished) {
			await copyVersionContents(latestPublished.id, draft.id, tx);
		}

		return draft;
	});

	return { version, created: true };
}

/**
 * Publish a draft. Verifies the draft has at least one task and no dependency
 * cycles, then freezes it. Previously published versions stay `published` so
 * existing builds keep a valid reference; planners can archive old ones.
 */
export async function publishDraftVersion(params: {
	versionId: string;
	organizationId: string;
	userId: string;
	changeNote?: string | null;
}): Promise<TemplateVersion> {
	const draft = await getOwnedDraftVersion(
		params.versionId,
		params.organizationId,
	);

	const tasks = await db.query.templateTaskTable.findMany({
		where: eq(templateTaskTable.versionId, draft.id),
		columns: { id: true },
	});

	if (tasks.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Add at least one task before publishing.",
		});
	}

	const dependencies = await db.query.templateTaskDependencyTable.findMany({
		where: inArray(
			templateTaskDependencyTable.templateTaskId,
			tasks.map((task) => task.id),
		),
	});

	if (
		hasDependencyCycle(
			tasks.map((task) => task.id),
			dependencies.map((dep) => [
				dep.templateTaskId,
				dep.dependsOnTemplateTaskId,
			]),
		)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Task dependencies contain a cycle.",
		});
	}

	const [published] = await db
		.update(templateVersionTable)
		.set({
			status: TemplateVersionStatus.published,
			publishedAt: new Date(),
			publishedById: params.userId,
			changeNote: params.changeNote ?? null,
		})
		.where(eq(templateVersionTable.id, draft.id))
		.returning();

	if (!published) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to publish version.",
		});
	}

	return published;
}

/**
 * Detect cycles in a dependency graph given as [task, dependsOn] edges.
 */
export function hasDependencyCycle(
	taskIds: string[],
	edges: Array<[string, string]>,
): boolean {
	const adjacency = new Map<string, string[]>();
	for (const id of taskIds) adjacency.set(id, []);
	for (const [task, dependsOn] of edges) {
		adjacency.get(task)?.push(dependsOn);
	}

	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;
	const color = new Map<string, number>();

	const visit = (node: string): boolean => {
		color.set(node, GRAY);
		for (const next of adjacency.get(node) ?? []) {
			const c = color.get(next) ?? WHITE;
			if (c === GRAY) return true;
			if (c === WHITE && visit(next)) return true;
		}
		color.set(node, BLACK);
		return false;
	};

	for (const id of taskIds) {
		if ((color.get(id) ?? WHITE) === WHITE && visit(id)) return true;
	}
	return false;
}

/**
 * Would adding `task -> dependsOn` create a cycle in the given version?
 */
export async function wouldCreateCycle(
	versionId: string,
	taskId: string,
	dependsOnId: string,
): Promise<boolean> {
	if (taskId === dependsOnId) return true;

	const tasks = await db.query.templateTaskTable.findMany({
		where: eq(templateTaskTable.versionId, versionId),
		columns: { id: true },
	});
	const ids = tasks.map((task) => task.id);

	const dependencies = await db.query.templateTaskDependencyTable.findMany({
		where: inArray(templateTaskDependencyTable.templateTaskId, ids),
	});

	const edges: Array<[string, string]> = dependencies.map((dep) => [
		dep.templateTaskId,
		dep.dependsOnTemplateTaskId,
	]);
	edges.push([taskId, dependsOnId]);

	return hasDependencyCycle(ids, edges);
}
