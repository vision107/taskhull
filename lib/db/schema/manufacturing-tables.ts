import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import {
	AttachmentKind,
	BuildStatus,
	BuildTaskAssignmentRole,
	BuildTaskStatus,
	ChecklistItemStatus,
	enumToPgEnum,
	RevisionAction,
	RevisionEntity,
	TemplateVersionStatus,
} from "./enums";
import { organizationTable, userTable } from "./tables";

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Template side — what planners edit
// ---------------------------------------------------------------------------

/**
 * A reusable task plan for a product. The template itself is the stable
 * identity; all task content lives on versions.
 */
export const templateTable = pgTable(
	"template",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdById: uuid("created_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(table) => [
		index("template_organization_id_idx").on(table.organizationId),
		index("template_archived_at_idx").on(table.archivedAt),
	],
);

/**
 * An immutable, numbered snapshot of a template's tasks. A template has at
 * most one `draft` version at a time; publishing freezes it.
 */
export const templateVersionTable = pgTable(
	"template_version",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		templateId: uuid("template_id")
			.notNull()
			.references(() => templateTable.id, { onDelete: "cascade" }),
		versionNumber: integer("version_number").notNull(),
		status: text("status", { enum: enumToPgEnum(TemplateVersionStatus) })
			.$type<TemplateVersionStatus>()
			.notNull()
			.default(TemplateVersionStatus.draft),
		changeNote: text("change_note"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		publishedById: uuid("published_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdById: uuid("created_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(table) => [
		index("template_version_template_id_idx").on(table.templateId),
		index("template_version_status_idx").on(table.status),
		uniqueIndex("template_version_template_number_idx").on(
			table.templateId,
			table.versionNumber,
		),
	],
);

export const templateTaskTable = pgTable(
	"template_task",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		versionId: uuid("version_id")
			.notNull()
			.references(() => templateVersionTable.id, { onDelete: "cascade" }),
		/**
		 * Stable identity of a task across versions of the same template. A brand
		 * new task gets its own id as lineage; copies made for the next draft
		 * inherit it. Lets a build be upgraded to a newer version while keeping
		 * progress on tasks that still exist.
		 */
		lineageId: uuid("lineage_id").notNull().defaultRandom(),
		/** Subtask of another task in the same version (one level deep). */
		parentTaskId: uuid("parent_task_id").references(
			(): AnyPgColumn => templateTaskTable.id,
			{ onDelete: "cascade" },
		),
		title: text("title").notNull(),
		instructions: text("instructions"),
		phase: text("phase"),
		/** Position among siblings (top-level tasks or subtasks of one parent). */
		sortOrder: integer("sort_order").notNull().default(0),
		durationDays: integer("duration_days").notNull().default(1),
		/** Planned effort in hours (independent of the calendar duration). */
		plannedHours: real("planned_hours"),
		requiresPhoto: boolean("requires_photo").notNull().default(false),
		requiresComment: boolean("requires_comment").notNull().default(false),
		...timestamps,
	},
	(table) => [
		index("template_task_version_id_idx").on(table.versionId),
		index("template_task_sort_order_idx").on(table.versionId, table.sortOrder),
		index("template_task_lineage_id_idx").on(table.lineageId),
		index("template_task_parent_task_id_idx").on(table.parentTaskId),
	],
);

export const templateTaskChecklistItemTable = pgTable(
	"template_task_checklist_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		templateTaskId: uuid("template_task_id")
			.notNull()
			.references(() => templateTaskTable.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		...timestamps,
	},
	(table) => [
		index("template_task_checklist_item_task_id_idx").on(table.templateTaskId),
	],
);

export const templateTaskDependencyTable = pgTable(
	"template_task_dependency",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		templateTaskId: uuid("template_task_id")
			.notNull()
			.references(() => templateTaskTable.id, { onDelete: "cascade" }),
		dependsOnTemplateTaskId: uuid("depends_on_template_task_id")
			.notNull()
			.references(() => templateTaskTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("template_task_dependency_unique_idx").on(
			table.templateTaskId,
			table.dependsOnTemplateTaskId,
		),
		index("template_task_dependency_task_id_idx").on(table.templateTaskId),
	],
);

/**
 * Documents attached to a template task (drawings, PDFs, wiring diagrams).
 * Copied by reference onto build tasks so workers can download them.
 */
export const templateTaskDocumentTable = pgTable(
	"template_task_document",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		templateTaskId: uuid("template_task_id")
			.notNull()
			.references(() => templateTaskTable.id, { onDelete: "cascade" }),
		uploadedById: uuid("uploaded_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		storageKey: text("storage_key").notNull(),
		fileName: text("file_name").notNull(),
		contentType: text("content_type"),
		sizeBytes: integer("size_bytes"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("template_task_document_task_id_idx").on(table.templateTaskId),
	],
);

// ---------------------------------------------------------------------------
// Execution side — what gets built and what workers see
// ---------------------------------------------------------------------------

/**
 * A product type that is manufactured repeatedly, e.g. "Machine XY".
 */
export const productTable = pgTable(
	"product",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		templateId: uuid("template_id").references(() => templateTable.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		description: text("description"),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdById: uuid("created_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(table) => [
		index("product_organization_id_idx").on(table.organizationId),
		index("product_template_id_idx").on(table.templateId),
	],
);

/**
 * One project = one manufactured unit (shown as "project" in the UI). Created
 * blank or from a template version. When linked to a version, later versions
 * never change the project until a planner upgrades it explicitly.
 */
export const buildTable = pgTable(
	"build",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		/** Legacy grouping; projects are grouped by template now. */
		productId: uuid("product_id").references(() => productTable.id, {
			onDelete: "set null",
		}),
		templateVersionId: uuid("template_version_id").references(
			() => templateVersionTable.id,
			{ onDelete: "set null" },
		),
		serialNumber: text("serial_number").notNull(),
		name: text("name"),
		description: text("description"),
		status: text("status", { enum: enumToPgEnum(BuildStatus) })
			.$type<BuildStatus>()
			.notNull()
			.default(BuildStatus.planned),
		plannedStartDate: date("planned_start_date"),
		plannedEndDate: date("planned_end_date"),
		actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
		actualCompletedAt: timestamp("actual_completed_at", { withTimezone: true }),
		createdById: uuid("created_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(table) => [
		index("build_organization_id_idx").on(table.organizationId),
		index("build_product_id_idx").on(table.productId),
		index("build_template_version_id_idx").on(table.templateVersionId),
		index("build_status_idx").on(table.status),
		uniqueIndex("build_org_serial_idx").on(
			table.organizationId,
			table.serialNumber,
		),
	],
);

export const buildTaskTable = pgTable(
	"build_task",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		buildId: uuid("build_id")
			.notNull()
			.references(() => buildTable.id, { onDelete: "cascade" }),
		sourceTemplateTaskId: uuid("source_template_task_id").references(
			() => templateTaskTable.id,
			{ onDelete: "set null" },
		),
		/** Subtask of another task in the same project (one level deep). */
		parentTaskId: uuid("parent_task_id").references(
			(): AnyPgColumn => buildTaskTable.id,
			{ onDelete: "cascade" },
		),
		title: text("title").notNull(),
		instructions: text("instructions"),
		phase: text("phase"),
		/** Position among siblings (top-level tasks or subtasks of one parent). */
		sortOrder: integer("sort_order").notNull().default(0),
		plannedDurationDays: integer("planned_duration_days").notNull().default(1),
		/** Planned effort in hours (independent of the calendar duration). */
		plannedHours: real("planned_hours"),
		startDate: date("start_date"),
		endDate: date("end_date"),
		status: text("status", { enum: enumToPgEnum(BuildTaskStatus) })
			.$type<BuildTaskStatus>()
			.notNull()
			.default(BuildTaskStatus.todo),
		requiresPhoto: boolean("requires_photo").notNull().default(false),
		requiresComment: boolean("requires_comment").notNull().default(false),
		actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
		actualCompletedAt: timestamp("actual_completed_at", { withTimezone: true }),
		completedById: uuid("completed_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		...timestamps,
	},
	(table) => [
		index("build_task_organization_id_idx").on(table.organizationId),
		index("build_task_build_id_idx").on(table.buildId),
		index("build_task_source_template_task_id_idx").on(
			table.sourceTemplateTaskId,
		),
		index("build_task_status_idx").on(table.status),
		index("build_task_dates_idx").on(table.startDate, table.endDate),
		index("build_task_parent_task_id_idx").on(table.parentTaskId),
	],
);

export const buildTaskDependencyTable = pgTable(
	"build_task_dependency",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		buildTaskId: uuid("build_task_id")
			.notNull()
			.references(() => buildTaskTable.id, { onDelete: "cascade" }),
		dependsOnBuildTaskId: uuid("depends_on_build_task_id")
			.notNull()
			.references(() => buildTaskTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("build_task_dependency_unique_idx").on(
			table.buildTaskId,
			table.dependsOnBuildTaskId,
		),
		index("build_task_dependency_task_id_idx").on(table.buildTaskId),
	],
);

export const buildTaskAssignmentTable = pgTable(
	"build_task_assignment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		buildTaskId: uuid("build_task_id")
			.notNull()
			.references(() => buildTaskTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: text("role", { enum: enumToPgEnum(BuildTaskAssignmentRole) })
			.$type<BuildTaskAssignmentRole>()
			.notNull()
			.default(BuildTaskAssignmentRole.owner),
		assignedById: uuid("assigned_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("build_task_assignment_unique_idx").on(
			table.buildTaskId,
			table.userId,
			table.role,
		),
		index("build_task_assignment_task_id_idx").on(table.buildTaskId),
		index("build_task_assignment_user_id_idx").on(table.userId),
	],
);

export const buildTaskChecklistItemTable = pgTable(
	"build_task_checklist_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		buildTaskId: uuid("build_task_id")
			.notNull()
			.references(() => buildTaskTable.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		status: text("status", { enum: enumToPgEnum(ChecklistItemStatus) })
			.$type<ChecklistItemStatus>()
			.notNull()
			.default(ChecklistItemStatus.open),
		completedById: uuid("completed_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		...timestamps,
	},
	(table) => [
		index("build_task_checklist_item_task_id_idx").on(table.buildTaskId),
	],
);

export const buildTaskCommentTable = pgTable(
	"build_task_comment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		buildTaskId: uuid("build_task_id")
			.notNull()
			.references(() => buildTaskTable.id, { onDelete: "cascade" }),
		authorId: uuid("author_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		body: text("body").notNull(),
		...timestamps,
	},
	(table) => [
		index("build_task_comment_task_id_idx").on(table.buildTaskId),
		index("build_task_comment_author_id_idx").on(table.authorId),
	],
);

/**
 * Files on a build task. `kind` tells documents (drawings, PDFs — copied from
 * the template or attached by a planner) from photos taken on the floor.
 * `templateDocumentId` is set when the document came from a template version.
 */
export const buildTaskAttachmentTable = pgTable(
	"build_task_attachment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		buildTaskId: uuid("build_task_id")
			.notNull()
			.references(() => buildTaskTable.id, { onDelete: "cascade" }),
		kind: text("kind", { enum: enumToPgEnum(AttachmentKind) })
			.$type<AttachmentKind>()
			.notNull()
			.default(AttachmentKind.photo),
		templateDocumentId: uuid("template_document_id").references(
			() => templateTaskDocumentTable.id,
			{ onDelete: "set null" },
		),
		uploadedById: uuid("uploaded_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		storageKey: text("storage_key").notNull(),
		fileName: text("file_name").notNull(),
		contentType: text("content_type"),
		sizeBytes: integer("size_bytes"),
		caption: text("caption"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("build_task_attachment_task_id_idx").on(table.buildTaskId),
		index("build_task_attachment_uploaded_by_id_idx").on(table.uploadedById),
	],
);

export const buildTaskActivityTable = pgTable(
	"build_task_activity",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		buildId: uuid("build_id").references(() => buildTable.id, {
			onDelete: "cascade",
		}),
		buildTaskId: uuid("build_task_id").references(() => buildTaskTable.id, {
			onDelete: "cascade",
		}),
		actorId: uuid("actor_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		action: text("action").notNull(),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("build_task_activity_organization_id_idx").on(table.organizationId),
		index("build_task_activity_build_id_idx").on(table.buildId),
		index("build_task_activity_task_id_idx").on(table.buildTaskId),
		index("build_task_activity_created_at_idx").on(table.createdAt),
	],
);

// ---------------------------------------------------------------------------
// Private tasks — a member's own to-do list inside an organization
// ---------------------------------------------------------------------------

/**
 * A personal note/to-do that only its author sees. Scoped to the organization
 * on purpose: it lives and dies with the membership, so leaving the
 * organization (or being removed from it) takes the list along.
 * `buildTaskId` optionally pins the note to a project task ("remember to ask
 * about the bracket on task X").
 */
export const privateTaskTable = pgTable(
	"private_task",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		buildTaskId: uuid("build_task_id").references(() => buildTaskTable.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		notes: text("notes"),
		dueDate: date("due_date"),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		...timestamps,
	},
	(table) => [
		index("private_task_org_user_idx").on(table.organizationId, table.userId),
		index("private_task_build_task_id_idx").on(table.buildTaskId),
	],
);

// ---------------------------------------------------------------------------
// Generic audit log
// ---------------------------------------------------------------------------

/**
 * Before/after JSON snapshots for tenant-owned entities. Written best-effort
 * alongside mutations; never used for business logic.
 */
export const revisionTable = pgTable(
	"revision",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		entityType: text("entity_type", { enum: enumToPgEnum(RevisionEntity) })
			.$type<RevisionEntity>()
			.notNull(),
		entityId: uuid("entity_id").notNull(),
		action: text("action", { enum: enumToPgEnum(RevisionAction) })
			.$type<RevisionAction>()
			.notNull(),
		changedById: uuid("changed_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		snapshot: jsonb("snapshot").$type<Record<string, unknown> | null>(),
		previousSnapshot: jsonb("previous_snapshot").$type<Record<
			string,
			unknown
		> | null>(),
		changedFields: jsonb("changed_fields").$type<string[] | null>(),
		summary: text("summary"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("revision_organization_id_idx").on(table.organizationId),
		index("revision_entity_idx").on(table.entityType, table.entityId),
		index("revision_created_at_idx").on(table.createdAt),
	],
);
