import { z } from "zod/v4";

import {
	BuildStatus,
	BuildTaskAssignmentRole,
	BuildTaskStatus,
	ChecklistItemStatus,
} from "@/lib/db/schema/enums";
import { type UploadKind, uploadRejection } from "@/lib/manufacturing/uploads";

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

const idSchema = z.object({ id: z.uuid() });

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const listTemplatesSchema = z.object({
	includeArchived: z.boolean().default(false),
});

export const getTemplateSchema = idSchema;

export const createTemplateSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(120),
	description: z.string().trim().max(2000).optional(),
});

export const updateTemplateSchema = z.object({
	id: z.uuid(),
	name: z.string().trim().min(1).max(120).optional(),
	description: z.string().trim().max(2000).nullable().optional(),
});

export const archiveTemplateSchema = z.object({
	id: z.uuid(),
	archived: z.boolean(),
});

export const getTemplateVersionSchema = z.object({ versionId: z.uuid() });

/** Creates a draft (copy of latest published) if none exists. */
export const ensureDraftSchema = z.object({ templateId: z.uuid() });

export const publishTemplateVersionSchema = z.object({
	versionId: z.uuid(),
	changeNote: z.string().trim().max(2000).optional(),
});

export const discardDraftSchema = z.object({ versionId: z.uuid() });

// Template tasks (only on draft versions)

/** Effort in hours, quarter-hour steps are fine; null clears it. */
const plannedHoursSchema = z.number().min(0).max(10_000);

const templateTaskFields = {
	title: z.string().trim().min(1, "Title is required").max(200),
	instructions: z.string().trim().max(10_000).nullable().optional(),
	phase: z.string().trim().max(80).nullable().optional(),
	durationDays: z.number().int().min(0).max(365).default(1),
	plannedHours: plannedHoursSchema.nullable().optional(),
	requiresPhoto: z.boolean().default(false),
	requiresComment: z.boolean().default(false),
	/** Make this a subtask of another task in the same version. */
	parentTaskId: z.uuid().optional(),
};

export const createTemplateTaskSchema = z.object({
	versionId: z.uuid(),
	...templateTaskFields,
	checklistItems: z.array(z.string().trim().min(1).max(200)).default([]),
});

export const updateTemplateTaskSchema = z.object({
	id: z.uuid(),
	title: templateTaskFields.title.optional(),
	instructions: templateTaskFields.instructions,
	phase: templateTaskFields.phase,
	durationDays: z.number().int().min(0).max(365).optional(),
	plannedHours: plannedHoursSchema.nullable().optional(),
	requiresPhoto: z.boolean().optional(),
	requiresComment: z.boolean().optional(),
});

export const deleteTemplateTaskSchema = idSchema;

export const reorderTemplateTasksSchema = z.object({
	versionId: z.uuid(),
	orderedTaskIds: z.array(z.uuid()).min(1),
});

export const setTemplateTaskChecklistSchema = z.object({
	templateTaskId: z.uuid(),
	items: z.array(
		z.object({
			id: z.uuid().optional(),
			title: z.string().trim().min(1).max(200),
		}),
	),
});

export const templateTaskDependencySchema = z.object({
	templateTaskId: z.uuid(),
	dependsOnTemplateTaskId: z.uuid(),
});

const uploadFileFields = {
	fileName: z.string().trim().min(1).max(255),
	contentType: z.string().trim().max(120).optional(),
	sizeBytes: z.number().int().min(1),
};

function refineUpload<T extends z.ZodObject<z.ZodRawShape>>(
	schema: T,
	kind: UploadKind,
) {
	return schema.superRefine((value, ctx) => {
		const file = value as unknown as {
			fileName: string;
			contentType?: string;
			sizeBytes: number;
		};
		const reason = uploadRejection(kind, file);
		if (reason) {
			ctx.addIssue({ code: "custom", message: reason, path: ["fileName"] });
		}
	});
}

export const addTemplateTaskDocumentSchema = refineUpload(
	z.object({
		templateTaskId: z.uuid(),
		storageKey: z.string().min(1).max(500),
		...uploadFileFields,
	}),
	"document",
);

export const removeTemplateTaskDocumentSchema = idSchema;

export const templateTaskDocumentUploadUrlSchema = refineUpload(
	z.object({
		templateTaskId: z.uuid(),
		...uploadFileFields,
	}),
	"document",
);

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const listProductsSchema = z.object({
	includeArchived: z.boolean().default(false),
});

export const getProductSchema = idSchema;

export const createProductSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(120),
	description: z.string().trim().max(2000).optional(),
	templateId: z.uuid().nullable().optional(),
});

export const updateProductSchema = z.object({
	id: z.uuid(),
	name: z.string().trim().min(1).max(120).optional(),
	description: z.string().trim().max(2000).nullable().optional(),
	templateId: z.uuid().nullable().optional(),
});

export const archiveProductSchema = z.object({
	id: z.uuid(),
	archived: z.boolean(),
});

// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

export const listBuildsSchema = z.object({
	productId: z.uuid().optional(),
	/** Only projects created from (any version of) this template. */
	templateId: z.uuid().optional(),
	status: z.array(z.enum(BuildStatus)).optional(),
	includeArchived: z.boolean().default(false),
});

export const getBuildSchema = idSchema;

/**
 * A project starts blank (no template) or from a template. Pass either
 * `templateVersionId` (exact version) or `templateId` (latest published).
 */
export const createBuildSchema = z.object({
	productId: z.uuid().optional(),
	templateId: z.uuid().optional(),
	templateVersionId: z.uuid().optional(),
	serialNumber: z
		.string()
		.trim()
		.min(1, "Serial number or name is required")
		.max(80),
	name: z.string().trim().max(120).optional(),
	description: z.string().trim().max(2000).optional(),
	plannedStartDate: isoDate,
});

export const updateBuildSchema = z.object({
	id: z.uuid(),
	serialNumber: z.string().trim().min(1).max(80).optional(),
	name: z.string().trim().max(120).nullable().optional(),
	description: z.string().trim().max(2000).nullable().optional(),
	status: z.enum(BuildStatus).optional(),
	plannedStartDate: isoDate.nullable().optional(),
	plannedEndDate: isoDate.nullable().optional(),
});

export const deleteBuildSchema = idSchema;

export const upgradeBuildSchema = z.object({
	buildId: z.uuid(),
	templateVersionId: z.uuid(),
});
export type UpgradeBuildInput = z.infer<typeof upgradeBuildSchema>;

/** Turn a project's task list into a brand new template (published v1). */
export const saveBuildAsTemplateSchema = z.object({
	buildId: z.uuid(),
	name: z.string().trim().min(1, "Name is required").max(120),
	description: z.string().trim().max(2000).optional(),
});

/** Push a linked project's task list into its template as a new version. */
export const updateTemplateFromBuildSchema = z.object({
	buildId: z.uuid(),
	changeNote: z.string().trim().max(2000).optional(),
});

export const templateDiffSchema = z.object({ buildId: z.uuid() });

// Build tasks (planner side)

export const getBuildTaskSchema = idSchema;

export const updateBuildTaskSchema = z.object({
	id: z.uuid(),
	title: z.string().trim().min(1).max(200).optional(),
	instructions: z.string().trim().max(10_000).nullable().optional(),
	phase: z.string().trim().max(80).nullable().optional(),
	startDate: isoDate.nullable().optional(),
	endDate: isoDate.nullable().optional(),
	plannedDurationDays: z.number().int().min(0).max(365).optional(),
	plannedHours: plannedHoursSchema.nullable().optional(),
	requiresPhoto: z.boolean().optional(),
	requiresComment: z.boolean().optional(),
	/** Replaces the task's dependencies when provided. */
	dependsOnIds: z.array(z.uuid()).max(30).optional(),
});

export const createBuildTaskSchema = z.object({
	buildId: z.uuid(),
	title: z.string().trim().min(1).max(200),
	instructions: z.string().trim().max(10_000).optional(),
	phase: z.string().trim().max(80).optional(),
	plannedDurationDays: z.number().int().min(0).max(365).default(1),
	plannedHours: plannedHoursSchema.nullable().optional(),
	startDate: isoDate.optional(),
	requiresPhoto: z.boolean().default(false),
	requiresComment: z.boolean().default(false),
	dependsOnIds: z.array(z.uuid()).max(30).default([]),
	/** Make this a subtask of another task in the same project. */
	parentTaskId: z.uuid().optional(),
});

export const deleteBuildTaskSchema = idSchema;

// Planner documents on project tasks (drawings, PDFs); photos come from workers.

export const buildTaskDocumentUploadUrlSchema = refineUpload(
	z.object({
		buildTaskId: z.uuid(),
		...uploadFileFields,
	}),
	"document",
);

export const addBuildTaskDocumentSchema = refineUpload(
	z.object({
		buildTaskId: z.uuid(),
		storageKey: z.string().min(1).max(500),
		...uploadFileFields,
	}),
	"document",
);

export const removeBuildTaskDocumentSchema = idSchema;

/**
 * Bulk assignment across builds: select any set of build tasks (typically the
 * same template task on several builds) and give them to one worker.
 */
export const assignBuildTasksSchema = z.object({
	buildTaskIds: z.array(z.uuid()).min(1).max(500),
	userId: z.uuid(),
	role: z.enum(BuildTaskAssignmentRole).default(BuildTaskAssignmentRole.owner),
	/** Replace existing assignees of that role instead of adding. */
	replace: z.boolean().default(true),
});

export const unassignBuildTasksSchema = z.object({
	buildTaskIds: z.array(z.uuid()).min(1).max(500),
	userId: z.uuid(),
	role: z.enum(BuildTaskAssignmentRole).optional(),
});

/** Matrix of template tasks × projects of a template, for the assignment grid. */
export const assignmentGridSchema = z.object({
	templateId: z.uuid(),
	buildIds: z.array(z.uuid()).max(50).optional(),
	includeCompleted: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Work (shared by planners and workers)
// ---------------------------------------------------------------------------

export const listMyTasksSchema = z.object({
	status: z.array(z.enum(BuildTaskStatus)).optional(),
	includeDone: z.boolean().default(false),
});

export const BLOCK_REASON_MAX = 2000;

export const updateBuildTaskStatusSchema = z.object({
	id: z.uuid(),
	status: z.enum(BuildTaskStatus),
	/** Required when moving to "blocked"; stored as a comment on the task. */
	reason: z.string().trim().min(1).max(BLOCK_REASON_MAX).optional(),
});

export const addBuildTaskCommentSchema = z.object({
	buildTaskId: z.uuid(),
	body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});

export const deleteBuildTaskCommentSchema = idSchema;

export const updateBuildTaskChecklistItemSchema = z.object({
	id: z.uuid(),
	status: z.enum(ChecklistItemStatus),
});

// Planner-side checklist editing on project tasks.
export const addBuildTaskChecklistItemSchema = z.object({
	buildTaskId: z.uuid(),
	title: z.string().trim().min(1, "Give the item a name").max(200),
});

export const removeBuildTaskChecklistItemSchema = idSchema;

export const buildTaskAttachmentUploadUrlSchema = refineUpload(
	z.object({
		buildTaskId: z.uuid(),
		...uploadFileFields,
	}),
	"photo",
);

export const addBuildTaskAttachmentSchema = refineUpload(
	z.object({
		buildTaskId: z.uuid(),
		storageKey: z.string().min(1).max(500),
		...uploadFileFields,
		caption: z.string().trim().max(500).optional(),
	}),
	"photo",
);

export const deleteBuildTaskAttachmentSchema = idSchema;

export const attachmentDownloadUrlSchema = z.object({
	attachmentId: z.uuid(),
});

export const listBuildTaskActivitySchema = z.object({
	buildTaskId: z.uuid().optional(),
	buildId: z.uuid().optional(),
	limit: z.number().int().min(1).max(200).default(50),
});

// ---------------------------------------------------------------------------
// Private tasks (a member's own to-do list, scoped to the organization)
// ---------------------------------------------------------------------------

export const PRIVATE_TASK_TITLE_MAX = 200;
export const PRIVATE_TASK_NOTES_MAX = 5000;

export const listPrivateTasksSchema = z.object({
	includeDone: z.boolean().default(false),
});

const privateTaskFields = {
	title: z
		.string()
		.trim()
		.min(1, "Title is required")
		.max(PRIVATE_TASK_TITLE_MAX),
	notes: z.string().trim().max(PRIVATE_TASK_NOTES_MAX).nullable().optional(),
	dueDate: isoDate.nullable().optional(),
	/** Pin the note to one of the organization's project tasks. */
	buildTaskId: z.uuid().nullable().optional(),
};

export const createPrivateTaskSchema = z.object(privateTaskFields);

export const updatePrivateTaskSchema = z.object({
	id: z.uuid(),
	title: privateTaskFields.title.optional(),
	notes: privateTaskFields.notes,
	dueDate: privateTaskFields.dueDate,
	buildTaskId: privateTaskFields.buildTaskId,
	done: z.boolean().optional(),
});

export const deletePrivateTaskSchema = idSchema;
