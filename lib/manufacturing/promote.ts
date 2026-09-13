import { TRPCError } from "@trpc/server";
import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { AttachmentKind, TemplateVersionStatus } from "@/lib/db/schema/enums";
import {
	buildTable,
	buildTaskAttachmentTable,
	buildTaskChecklistItemTable,
	buildTaskTable,
	templateTable,
	templateTaskChecklistItemTable,
	templateTaskDependencyTable,
	templateTaskDocumentTable,
	templateTaskTable,
	templateVersionTable,
} from "@/lib/db/schema/manufacturing-tables";
import { ActivityAction, logActivity } from "@/lib/manufacturing/activity";
import { getOwnedBuild } from "@/lib/manufacturing/builds";
import {
	getDraftVersion,
	hasDependencyCycle,
} from "@/lib/manufacturing/template-versions";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// ---------------------------------------------------------------------------
// Snapshots + pure diff
// ---------------------------------------------------------------------------

/** What a project task contributes to a template task. */
export interface BuildTaskSnapshot {
	id: string;
	sourceTemplateTaskId: string | null;
	title: string;
	instructions: string | null;
	phase: string | null;
	sortOrder: number;
	durationDays: number;
	plannedHours: number | null;
	requiresPhoto: boolean;
	requiresComment: boolean;
	checklist: string[];
	/** Ids of other project tasks this one depends on. */
	dependsOn: string[];
	documents: DocumentSnapshot[];
}

export interface DocumentSnapshot {
	/** Attachment / document id in its own table. */
	id: string;
	storageKey: string;
	fileName: string;
	contentType: string | null;
	sizeBytes: number | null;
	uploadedById: string | null;
}

export interface TemplateTaskSnapshot {
	id: string;
	lineageId: string;
	title: string;
	instructions: string | null;
	phase: string | null;
	sortOrder: number;
	durationDays: number;
	plannedHours: number | null;
	requiresPhoto: boolean;
	requiresComment: boolean;
	checklist: string[];
	dependsOn: string[];
	documents: DocumentSnapshot[];
}

export interface PromoteDiff {
	added: { title: string }[];
	updated: { title: string; fields: string[] }[];
	removed: { title: string }[];
	unchanged: number;
}

export function hasChanges(diff: PromoteDiff): boolean {
	return (
		diff.added.length > 0 || diff.updated.length > 0 || diff.removed.length > 0
	);
}

const norm = (value: string | null | undefined) => (value ?? "").trim();
const sameList = (a: string[], b: string[]) =>
	a.length === b.length && a.every((item, index) => item === b[index]);
const sameSet = (a: string[], b: string[]) => {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((item) => set.has(item));
};

/**
 * Compare a project's tasks with a template version. Tasks match by lineage:
 * a project task whose source template task has lineage L matches the version
 * task with lineage L. Project tasks without a match are additions, version
 * tasks without a match are removals. Pure; used for the preview and for the
 * summary of an actual push.
 */
export function diffBuildAgainstVersion(
	buildTasks: BuildTaskSnapshot[],
	versionTasks: TemplateTaskSnapshot[],
	lineageBySourceId: Map<string, string>,
): PromoteDiff {
	const versionByLineage = new Map(
		versionTasks.map((task) => [task.lineageId, task]),
	);
	const lineageOfBuildTask = new Map<string, string>();
	for (const task of buildTasks) {
		const lineage = task.sourceTemplateTaskId
			? lineageBySourceId.get(task.sourceTemplateTaskId)
			: undefined;
		if (lineage && versionByLineage.has(lineage)) {
			lineageOfBuildTask.set(task.id, lineage);
		}
	}
	const versionIdByLineage = new Map(
		versionTasks.map((task) => [task.lineageId, task.id]),
	);

	const diff: PromoteDiff = {
		added: [],
		updated: [],
		removed: [],
		unchanged: 0,
	};
	const matchedLineages = new Set<string>();

	for (const task of buildTasks) {
		const lineage = lineageOfBuildTask.get(task.id);
		const counterpart = lineage ? versionByLineage.get(lineage) : undefined;
		if (!(lineage && counterpart)) {
			diff.added.push({ title: task.title });
			continue;
		}
		matchedLineages.add(lineage);

		const fields: string[] = [];
		if (norm(task.title) !== norm(counterpart.title)) fields.push("title");
		if (norm(task.instructions) !== norm(counterpart.instructions))
			fields.push("instructions");
		if (norm(task.phase) !== norm(counterpart.phase)) fields.push("phase");
		if (task.durationDays !== counterpart.durationDays) fields.push("duration");
		if ((task.plannedHours ?? null) !== (counterpart.plannedHours ?? null))
			fields.push("hours");
		if (task.requiresPhoto !== counterpart.requiresPhoto)
			fields.push("photo required");
		if (task.requiresComment !== counterpart.requiresComment)
			fields.push("comment required");
		if (
			!sameList(
				task.checklist.map((item) => norm(item).toLowerCase()),
				counterpart.checklist.map((item) => norm(item).toLowerCase()),
			)
		)
			fields.push("checklist");
		// Dependencies compare as sets of version task ids.
		const taskDeps = task.dependsOn.flatMap((depId) => {
			const depLineage = lineageOfBuildTask.get(depId);
			const versionTaskId = depLineage
				? versionIdByLineage.get(depLineage)
				: undefined;
			return versionTaskId ? [versionTaskId] : [`new:${depId}`];
		});
		if (!sameSet(taskDeps, counterpart.dependsOn)) fields.push("order");
		if (
			!sameSet(
				task.documents.map((doc) => doc.storageKey),
				counterpart.documents.map((doc) => doc.storageKey),
			)
		)
			fields.push("documents");

		if (fields.length > 0) diff.updated.push({ title: task.title, fields });
		else diff.unchanged++;
	}

	for (const task of versionTasks) {
		if (!matchedLineages.has(task.lineageId)) {
			diff.removed.push({ title: task.title });
		}
	}

	return diff;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export async function loadBuildSnapshot(
	buildId: string,
): Promise<BuildTaskSnapshot[]> {
	const tasks = await db.query.buildTaskTable.findMany({
		where: eq(buildTaskTable.buildId, buildId),
		orderBy: [asc(buildTaskTable.sortOrder), asc(buildTaskTable.createdAt)],
		with: {
			checklistItems: { orderBy: asc(buildTaskChecklistItemTable.sortOrder) },
			dependencies: { columns: { dependsOnBuildTaskId: true } },
			attachments: {
				where: eq(buildTaskAttachmentTable.kind, AttachmentKind.document),
			},
		},
	});

	return tasks.map((task, index) => ({
		id: task.id,
		sourceTemplateTaskId: task.sourceTemplateTaskId,
		title: task.title,
		instructions: task.instructions,
		phase: task.phase,
		// Normalise to a dense order so the template reads top to bottom.
		sortOrder: index,
		durationDays: task.plannedDurationDays,
		plannedHours: task.plannedHours,
		requiresPhoto: task.requiresPhoto,
		requiresComment: task.requiresComment,
		checklist: task.checklistItems.map((item) => item.title),
		dependsOn: task.dependencies.map((dep) => dep.dependsOnBuildTaskId),
		documents: task.attachments.map((att) => ({
			id: att.id,
			storageKey: att.storageKey,
			fileName: att.fileName,
			contentType: att.contentType,
			sizeBytes: att.sizeBytes,
			uploadedById: att.uploadedById,
		})),
	}));
}

export async function loadVersionSnapshot(
	versionId: string,
): Promise<TemplateTaskSnapshot[]> {
	const tasks = await db.query.templateTaskTable.findMany({
		where: eq(templateTaskTable.versionId, versionId),
		orderBy: asc(templateTaskTable.sortOrder),
		with: {
			checklistItems: {
				orderBy: asc(templateTaskChecklistItemTable.sortOrder),
			},
			dependencies: { columns: { dependsOnTemplateTaskId: true } },
			documents: true,
		},
	});

	return tasks.map((task) => ({
		id: task.id,
		lineageId: task.lineageId,
		title: task.title,
		instructions: task.instructions,
		phase: task.phase,
		sortOrder: task.sortOrder,
		durationDays: task.durationDays,
		plannedHours: task.plannedHours,
		requiresPhoto: task.requiresPhoto,
		requiresComment: task.requiresComment,
		checklist: task.checklistItems.map((item) => item.title),
		dependsOn: task.dependencies.map((dep) => dep.dependsOnTemplateTaskId),
		documents: task.documents.map((doc) => ({
			id: doc.id,
			storageKey: doc.storageKey,
			fileName: doc.fileName,
			contentType: doc.contentType,
			sizeBytes: doc.sizeBytes,
			uploadedById: doc.uploadedById,
		})),
	}));
}

/**
 * lineage of every template task the project tasks point at. Source tasks may
 * live on older versions of the template, so look them up by id, not version.
 */
async function loadLineages(
	buildTasks: BuildTaskSnapshot[],
): Promise<Map<string, string>> {
	const ids = buildTasks
		.map((task) => task.sourceTemplateTaskId)
		.filter((id): id is string => Boolean(id));
	if (ids.length === 0) return new Map();
	const rows = await db.query.templateTaskTable.findMany({
		where: inArray(templateTaskTable.id, Array.from(new Set(ids))),
		columns: { id: true, lineageId: true },
	});
	return new Map(rows.map((row) => [row.id, row.lineageId]));
}

// ---------------------------------------------------------------------------
// Writing a version from project tasks
// ---------------------------------------------------------------------------

interface WriteResult {
	/** project task id -> template task id */
	taskIds: Map<string, string>;
	/** project attachment id -> template document id */
	documentIds: Map<string, string>;
}

async function writeTasksToVersion(
	tx: Tx,
	versionId: string,
	tasks: BuildTaskSnapshot[],
	lineageBySourceId: Map<string, string>,
): Promise<WriteResult> {
	const taskIds = new Map<string, string>();
	const documentIds = new Map<string, string>();

	for (const task of tasks) {
		const lineageId = task.sourceTemplateTaskId
			? lineageBySourceId.get(task.sourceTemplateTaskId)
			: undefined;
		const [created] = await tx
			.insert(templateTaskTable)
			.values({
				versionId,
				...(lineageId ? { lineageId } : {}),
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
		taskIds.set(task.id, created.id);

		if (task.checklist.length > 0) {
			await tx.insert(templateTaskChecklistItemTable).values(
				task.checklist.map((title, index) => ({
					templateTaskId: created.id,
					title,
					sortOrder: index,
				})),
			);
		}

		for (const doc of task.documents) {
			const [document] = await tx
				.insert(templateTaskDocumentTable)
				.values({
					templateTaskId: created.id,
					uploadedById: doc.uploadedById,
					storageKey: doc.storageKey,
					fileName: doc.fileName,
					contentType: doc.contentType,
					sizeBytes: doc.sizeBytes,
				})
				.returning({ id: templateTaskDocumentTable.id });
			if (document) documentIds.set(doc.id, document.id);
		}
	}

	const dependencyRows = tasks.flatMap((task) =>
		task.dependsOn.flatMap((depId) => {
			const templateTaskId = taskIds.get(task.id);
			const dependsOnTemplateTaskId = taskIds.get(depId);
			if (!(templateTaskId && dependsOnTemplateTaskId)) return [];
			return [{ templateTaskId, dependsOnTemplateTaskId }];
		}),
	);
	if (dependencyRows.length > 0) {
		await tx
			.insert(templateTaskDependencyTable)
			.values(dependencyRows)
			.onConflictDoNothing();
	}

	return { taskIds, documentIds };
}

/**
 * After writing a version from a project, point the project at it so it is
 * "up to date" and later upgrades match tasks by lineage.
 */
async function linkBuildToVersion(
	tx: Tx,
	buildId: string,
	versionId: string,
	written: WriteResult,
) {
	await tx
		.update(buildTable)
		.set({ templateVersionId: versionId })
		.where(eq(buildTable.id, buildId));

	for (const [buildTaskId, templateTaskId] of written.taskIds) {
		await tx
			.update(buildTaskTable)
			.set({ sourceTemplateTaskId: templateTaskId })
			.where(eq(buildTaskTable.id, buildTaskId));
	}
	for (const [attachmentId, templateDocumentId] of written.documentIds) {
		await tx
			.update(buildTaskAttachmentTable)
			.set({ templateDocumentId })
			.where(eq(buildTaskAttachmentTable.id, attachmentId));
	}
}

function assertNoCycle(tasks: BuildTaskSnapshot[]) {
	const edges: Array<[string, string]> = tasks.flatMap((task) =>
		task.dependsOn.map((dep) => [task.id, dep] as [string, string]),
	);
	if (
		hasDependencyCycle(
			tasks.map((task) => task.id),
			edges,
		)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The project's task order contains a loop.",
		});
	}
}

// ---------------------------------------------------------------------------
// Public operations
// ---------------------------------------------------------------------------

/**
 * Turn a project's task list into a brand new template with a published v1
 * and link the project to it.
 */
export async function saveBuildAsTemplate(params: {
	organizationId: string;
	userId: string;
	buildId: string;
	name: string;
	description?: string | null;
}) {
	const build = await getOwnedBuild(params.buildId, params.organizationId);
	if (build.templateVersionId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"This project already belongs to a template. Use “Update template” instead.",
		});
	}

	const tasks = await loadBuildSnapshot(build.id);
	if (tasks.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Add at least one task before saving the project as a template.",
		});
	}
	assertNoCycle(tasks);

	const result = await db.transaction(async (tx) => {
		const [template] = await tx
			.insert(templateTable)
			.values({
				organizationId: params.organizationId,
				name: params.name,
				description: params.description || null,
				createdById: params.userId,
			})
			.returning();
		if (!template) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create template.",
			});
		}

		const [version] = await tx
			.insert(templateVersionTable)
			.values({
				templateId: template.id,
				versionNumber: 1,
				status: TemplateVersionStatus.published,
				changeNote: `Created from project ${build.serialNumber}`,
				publishedAt: new Date(),
				publishedById: params.userId,
				createdById: params.userId,
			})
			.returning();
		if (!version) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create template version.",
			});
		}

		// Ad-hoc tasks have no source, so every task gets a fresh lineage.
		const written = await writeTasksToVersion(tx, version.id, tasks, new Map());
		await linkBuildToVersion(tx, build.id, version.id, written);

		return { template, version };
	});

	await logActivity({
		organizationId: params.organizationId,
		buildId: build.id,
		actorId: params.userId,
		action: ActivityAction.buildSavedAsTemplate,
		metadata: {
			templateId: result.template.id,
			templateName: result.template.name,
			taskCount: tasks.length,
		},
	});

	return result;
}

/**
 * What would change in the template if the project were pushed now.
 */
export async function previewTemplateUpdate(params: {
	organizationId: string;
	buildId: string;
}) {
	const build = await getOwnedBuild(params.buildId, params.organizationId);
	if (!build.templateVersionId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This project is not linked to a template yet.",
		});
	}
	const current = await db.query.templateVersionTable.findFirst({
		where: eq(templateVersionTable.id, build.templateVersionId),
		with: { template: { columns: { id: true, name: true } } },
	});
	if (!current) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." });
	}

	// Compare against the template's latest published version, which is what
	// the next project would get.
	const latest = await db.query.templateVersionTable.findFirst({
		where: eq(templateVersionTable.templateId, current.templateId),
		orderBy: (table, { desc }) => desc(table.versionNumber),
		columns: { id: true, versionNumber: true, status: true },
	});
	const baseline =
		latest && latest.status === TemplateVersionStatus.published
			? latest
			: current;

	const [buildTasks, versionTasks] = await Promise.all([
		loadBuildSnapshot(build.id),
		loadVersionSnapshot(baseline.id),
	]);
	const lineages = await loadLineages(buildTasks);
	const diff = diffBuildAgainstVersion(buildTasks, versionTasks, lineages);
	const draft = await getDraftVersion(current.templateId);

	return {
		template: current.template,
		baselineVersionNumber: baseline.versionNumber,
		nextVersionNumber: (latest?.versionNumber ?? current.versionNumber) + 1,
		openDraftVersionNumber: draft?.versionNumber ?? null,
		diff,
	};
}

/**
 * Push a linked project's task list into its template as a new published
 * version and re-point the project at it.
 */
export async function updateTemplateFromBuild(params: {
	organizationId: string;
	userId: string;
	buildId: string;
	changeNote?: string | null;
}) {
	const build = await getOwnedBuild(params.buildId, params.organizationId);
	if (!build.templateVersionId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"This project is not linked to a template. Use “Save as template” first.",
		});
	}
	const current = await db.query.templateVersionTable.findFirst({
		where: eq(templateVersionTable.id, build.templateVersionId),
		with: { template: true },
	});
	if (!current || current.template.organizationId !== params.organizationId) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." });
	}
	if (current.template.archivedAt) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The template is archived. Restore it first.",
		});
	}

	const draft = await getDraftVersion(current.templateId);
	if (draft) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `The template has an open draft (v${draft.versionNumber}). Publish or discard it first.`,
		});
	}

	const tasks = await loadBuildSnapshot(build.id);
	if (tasks.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The project has no tasks to push.",
		});
	}
	assertNoCycle(tasks);

	const latest = await db.query.templateVersionTable.findFirst({
		where: eq(templateVersionTable.templateId, current.templateId),
		orderBy: (table, { desc }) => desc(table.versionNumber),
	});
	const baseline = latest ?? current;
	const [versionTasks, lineages] = await Promise.all([
		loadVersionSnapshot(baseline.id),
		loadLineages(tasks),
	]);
	const diff = diffBuildAgainstVersion(tasks, versionTasks, lineages);
	if (!hasChanges(diff)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The template already matches this project.",
		});
	}

	const version = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(templateVersionTable)
			.values({
				templateId: current.templateId,
				versionNumber: baseline.versionNumber + 1,
				status: TemplateVersionStatus.published,
				changeNote:
					params.changeNote?.trim() ||
					`Updated from project ${build.serialNumber}`,
				publishedAt: new Date(),
				publishedById: params.userId,
				createdById: params.userId,
			})
			.returning();
		if (!created) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create template version.",
			});
		}

		const written = await writeTasksToVersion(tx, created.id, tasks, lineages);
		await linkBuildToVersion(tx, build.id, created.id, written);
		return created;
	});

	await logActivity({
		organizationId: params.organizationId,
		buildId: build.id,
		actorId: params.userId,
		action: ActivityAction.buildPushedToTemplate,
		metadata: {
			templateId: current.templateId,
			templateName: current.template.name,
			versionNumber: version.versionNumber,
			added: diff.added.length,
			updated: diff.updated.length,
			removed: diff.removed.length,
		},
	});

	return { version, template: current.template, diff };
}
