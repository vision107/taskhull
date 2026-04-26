import { z } from "zod";
import {
	DependencyTypes,
	ProjectRoles,
	ProjectStatuses,
	TaskPriorities,
	TaskStatusTypes,
} from "@/lib/db/schema/enums";

// ─── Project Schemas ──────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	icon: z.string().optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
});

export const updateProjectSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional().nullable(),
	status: z.enum(ProjectStatuses as [string, ...string[]]).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	icon: z.string().optional().nullable(),
	startDate: z.date().optional().nullable(),
	endDate: z.date().optional().nullable(),
});

export const getProjectSchema = z.object({
	id: z.string().uuid(),
});

export const deleteProjectSchema = z.object({
	id: z.string().uuid(),
});

export const cloneProjectSchema = z.object({
	sourceProjectId: z.string().uuid(),
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	startDate: z.date().optional().nullable(),
	// If provided, all task dates are shifted by (newStartDate - oldStartDate) days.
	// If omitted, tasks are copied without any dates.
	copyTaskDates: z.boolean().optional().default(false),
	// Carry over assignees from source tasks. Workers often repeat across products.
	copyAssignees: z.boolean().optional().default(true),
});

export const favoriteProjectSchema = z.object({
	projectId: z.string().uuid(),
});

export const unfavoriteProjectSchema = z.object({
	projectId: z.string().uuid(),
});

export const shiftProjectSchema = z.object({
	projectId: z.string().uuid(),
	// Positive to push into the future, negative to pull forward.
	days: z.number().int(),
	// When true, also shift every task's start/due dates by the same delta.
	cascadeTasks: z.boolean().optional().default(true),
	// When true, also shift every downstream clone (and their tasks).
	cascadeClones: z.boolean().optional().default(false),
});

export const addProjectMemberSchema = z.object({
	projectId: z.string().uuid(),
	userId: z.string().uuid(),
	role: z.enum(ProjectRoles as [string, ...string[]]),
});

export const updateProjectMemberSchema = z.object({
	projectId: z.string().uuid(),
	userId: z.string().uuid(),
	role: z.enum(ProjectRoles as [string, ...string[]]),
});

export const removeProjectMemberSchema = z.object({
	projectId: z.string().uuid(),
	userId: z.string().uuid(),
});

// ─── Task Status Schemas ──────────────────────────────────────────────────────

export const createTaskStatusSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string().min(1).max(100),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	type: z.enum(TaskStatusTypes as [string, ...string[]]),
	order: z.number().int().min(0).optional(),
});

export const updateTaskStatusConfigSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
	type: z.enum(TaskStatusTypes as [string, ...string[]]).optional(),
	order: z.number().int().min(0).optional(),
});

export const deleteTaskStatusSchema = z.object({
	id: z.string().uuid(),
});

// ─── Label Schemas ────────────────────────────────────────────────────────────

export const createLabelSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string().min(1).max(100),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateLabelSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const deleteLabelSchema = z.object({
	id: z.string().uuid(),
});

// ─── Task Schemas ─────────────────────────────────────────────────────────────

export const listTasksSchema = z.object({
	projectId: z.string().uuid(),
	assigneeId: z.string().uuid().optional(),
	statusId: z.string().uuid().optional(),
	priority: z.enum(TaskPriorities as [string, ...string[]]).optional(),
	parentId: z.string().uuid().nullable().optional(),
	labelIds: z.array(z.string().uuid()).optional(),
	startDateFrom: z.date().optional(),
	startDateTo: z.date().optional(),
	dueDateFrom: z.date().optional(),
	dueDateTo: z.date().optional(),
	query: z.string().optional(),
	includeCompleted: z.boolean().optional().default(true),
	limit: z.number().int().min(1).max(500).optional().default(200),
	offset: z.number().int().min(0).optional().default(0),
});

/**
 * Cross-project task list, scoped to the current organization.
 * Used by the desktop "My Tasks" surface.
 */
export const listTasksForOrgSchema = z.object({
	// If omitted, return tasks the current user is assigned to (the default
	// for the "My Tasks" page). Pass null to explicitly include unassigned.
	assigneeId: z.union([z.string().uuid(), z.null()]).optional(),
	projectIds: z.array(z.string().uuid()).optional(),
	statusTypes: z
		.array(z.enum(TaskStatusTypes as [string, ...string[]]))
		.optional(),
	priority: z.enum(TaskPriorities as [string, ...string[]]).optional(),
	query: z.string().optional(),
	dueDateFrom: z.date().optional(),
	dueDateTo: z.date().optional(),
	includeCompleted: z.boolean().optional().default(false),
	// "mine" restricts assigneeId to the caller; ignored if assigneeId is set.
	onlyMine: z.boolean().optional().default(true),
	limit: z.number().int().min(1).max(1000).optional().default(500),
	offset: z.number().int().min(0).optional().default(0),
});

/**
 * Bulk completion of tasks by IDs, intended for the "mark all identical
 * tasks done at once" worker flow.
 */
export const bulkCompleteTasksSchema = z.object({
	ids: z.array(z.string().uuid()).min(1),
});

/**
 * Aggregated stats for a task template (identified by the shared ancestor
 * `templateTaskId` chain root). Used by the learning loop UI.
 */
export const getTemplateStatsSchema = z.object({
	// Any task in the chain; the server walks back to the root and aggregates.
	taskId: z.string().uuid(),
});

export const getTaskSchema = z.object({
	id: z.string().uuid(),
});

export const createTaskSchema = z.object({
	projectId: z.string().uuid(),
	title: z.string().min(1).max(500),
	description: z.any().optional(),
	statusId: z.string().uuid().optional(),
	priority: z
		.enum(TaskPriorities as [string, ...string[]])
		.optional()
		.default("none"),
	assigneeId: z.string().uuid().optional().nullable(),
	parentId: z.string().uuid().optional().nullable(),
	startDate: z.date().optional().nullable(),
	dueDate: z.date().optional().nullable(),
	estimatedHours: z.number().min(0).optional().nullable(),
	labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).max(500).optional(),
	description: z.any().optional().nullable(),
	statusId: z.string().uuid().optional().nullable(),
	priority: z.enum(TaskPriorities as [string, ...string[]]).optional(),
	assigneeId: z.string().uuid().optional().nullable(),
	parentId: z.string().uuid().optional().nullable(),
	startDate: z.date().optional().nullable(),
	dueDate: z.date().optional().nullable(),
	estimatedHours: z.number().min(0).optional().nullable(),
	actualHours: z.number().min(0).optional().nullable(),
	sortOrder: z.number().optional(),
	labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskStatusAssignmentSchema = z.object({
	id: z.string().uuid(),
	statusId: z.string().uuid().nullable(),
});

export const deleteTaskSchema = z.object({
	id: z.string().uuid(),
});

export const bulkUpdateTasksSchema = z.object({
	ids: z.array(z.string().uuid()).min(1),
	statusId: z.string().uuid().optional().nullable(),
	priority: z.enum(TaskPriorities as [string, ...string[]]).optional(),
	assigneeId: z.string().uuid().optional().nullable(),
	dueDate: z.date().optional().nullable(),
});

export const reorderTasksSchema = z.object({
	projectId: z.string().uuid(),
	updates: z.array(
		z.object({
			id: z.string().uuid(),
			sortOrder: z.number(),
		}),
	),
});

// ─── Comment Schemas ──────────────────────────────────────────────────────────

export const listCommentsSchema = z.object({
	taskId: z.string().uuid(),
});

export const createCommentSchema = z.object({
	taskId: z.string().uuid(),
	content: z.any(),
});

export const updateCommentSchema = z.object({
	id: z.string().uuid(),
	content: z.any(),
});

export const deleteCommentSchema = z.object({
	id: z.string().uuid(),
});

// ─── Activity Schemas ─────────────────────────────────────────────────────────

export const listActivitiesSchema = z.object({
	taskId: z.string().uuid(),
	limit: z.number().int().min(1).max(100).optional().default(50),
	offset: z.number().int().min(0).optional().default(0),
});

// ─── Dependency Schemas ───────────────────────────────────────────────────────

export const addDependencySchema = z.object({
	predecessorId: z.string().uuid(),
	successorId: z.string().uuid(),
	type: z.enum(DependencyTypes as [string, ...string[]]).optional().default("finish_to_start"),
});

export const removeDependencySchema = z.object({
	id: z.string().uuid(),
});

// ─── Attachment Schemas ───────────────────────────────────────────────────────

export const createAttachmentSchema = z.object({
	taskId: z.string().uuid(),
	fileName: z.string().min(1),
	fileKey: z.string().min(1),
	fileSize: z.number().int().optional(),
	mimeType: z.string().optional(),
});

export const deleteAttachmentSchema = z.object({
	id: z.string().uuid(),
});
