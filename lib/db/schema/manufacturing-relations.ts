import { relations } from "drizzle-orm";

import {
	buildTable,
	buildTaskActivityTable,
	buildTaskAssignmentTable,
	buildTaskAttachmentTable,
	buildTaskChecklistItemTable,
	buildTaskCommentTable,
	buildTaskDependencyTable,
	buildTaskTable,
	productTable,
	revisionTable,
	templateTable,
	templateTaskChecklistItemTable,
	templateTaskDependencyTable,
	templateTaskDocumentTable,
	templateTaskTable,
	templateVersionTable,
} from "./manufacturing-tables";
import { organizationTable, userTable } from "./tables";

// Template side

export const templateRelations = relations(templateTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [templateTable.organizationId],
		references: [organizationTable.id],
	}),
	createdBy: one(userTable, {
		fields: [templateTable.createdById],
		references: [userTable.id],
	}),
	versions: many(templateVersionTable),
	products: many(productTable),
}));

export const templateVersionRelations = relations(
	templateVersionTable,
	({ one, many }) => ({
		template: one(templateTable, {
			fields: [templateVersionTable.templateId],
			references: [templateTable.id],
		}),
		publishedBy: one(userTable, {
			fields: [templateVersionTable.publishedById],
			references: [userTable.id],
			relationName: "templateVersionPublisher",
		}),
		createdBy: one(userTable, {
			fields: [templateVersionTable.createdById],
			references: [userTable.id],
			relationName: "templateVersionCreator",
		}),
		tasks: many(templateTaskTable),
		builds: many(buildTable),
	}),
);

export const templateTaskRelations = relations(
	templateTaskTable,
	({ one, many }) => ({
		version: one(templateVersionTable, {
			fields: [templateTaskTable.versionId],
			references: [templateVersionTable.id],
		}),
		parent: one(templateTaskTable, {
			fields: [templateTaskTable.parentTaskId],
			references: [templateTaskTable.id],
			relationName: "templateTaskParent",
		}),
		subtasks: many(templateTaskTable, { relationName: "templateTaskParent" }),
		checklistItems: many(templateTaskChecklistItemTable),
		documents: many(templateTaskDocumentTable),
		dependencies: many(templateTaskDependencyTable, {
			relationName: "templateTaskDependent",
		}),
		dependents: many(templateTaskDependencyTable, {
			relationName: "templateTaskDependency",
		}),
	}),
);

export const templateTaskChecklistItemRelations = relations(
	templateTaskChecklistItemTable,
	({ one }) => ({
		templateTask: one(templateTaskTable, {
			fields: [templateTaskChecklistItemTable.templateTaskId],
			references: [templateTaskTable.id],
		}),
	}),
);

export const templateTaskDependencyRelations = relations(
	templateTaskDependencyTable,
	({ one }) => ({
		templateTask: one(templateTaskTable, {
			fields: [templateTaskDependencyTable.templateTaskId],
			references: [templateTaskTable.id],
			relationName: "templateTaskDependent",
		}),
		dependsOn: one(templateTaskTable, {
			fields: [templateTaskDependencyTable.dependsOnTemplateTaskId],
			references: [templateTaskTable.id],
			relationName: "templateTaskDependency",
		}),
	}),
);

export const templateTaskDocumentRelations = relations(
	templateTaskDocumentTable,
	({ one }) => ({
		templateTask: one(templateTaskTable, {
			fields: [templateTaskDocumentTable.templateTaskId],
			references: [templateTaskTable.id],
		}),
		uploadedBy: one(userTable, {
			fields: [templateTaskDocumentTable.uploadedById],
			references: [userTable.id],
		}),
	}),
);

// Execution side

export const productRelations = relations(productTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [productTable.organizationId],
		references: [organizationTable.id],
	}),
	template: one(templateTable, {
		fields: [productTable.templateId],
		references: [templateTable.id],
	}),
	createdBy: one(userTable, {
		fields: [productTable.createdById],
		references: [userTable.id],
	}),
	builds: many(buildTable),
}));

export const buildRelations = relations(buildTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [buildTable.organizationId],
		references: [organizationTable.id],
	}),
	product: one(productTable, {
		fields: [buildTable.productId],
		references: [productTable.id],
	}),
	templateVersion: one(templateVersionTable, {
		fields: [buildTable.templateVersionId],
		references: [templateVersionTable.id],
	}),
	createdBy: one(userTable, {
		fields: [buildTable.createdById],
		references: [userTable.id],
	}),
	tasks: many(buildTaskTable),
	activity: many(buildTaskActivityTable),
}));

export const buildTaskRelations = relations(
	buildTaskTable,
	({ one, many }) => ({
		organization: one(organizationTable, {
			fields: [buildTaskTable.organizationId],
			references: [organizationTable.id],
		}),
		build: one(buildTable, {
			fields: [buildTaskTable.buildId],
			references: [buildTable.id],
		}),
		sourceTemplateTask: one(templateTaskTable, {
			fields: [buildTaskTable.sourceTemplateTaskId],
			references: [templateTaskTable.id],
		}),
		completedBy: one(userTable, {
			fields: [buildTaskTable.completedById],
			references: [userTable.id],
		}),
		parent: one(buildTaskTable, {
			fields: [buildTaskTable.parentTaskId],
			references: [buildTaskTable.id],
			relationName: "buildTaskParent",
		}),
		subtasks: many(buildTaskTable, { relationName: "buildTaskParent" }),
		assignments: many(buildTaskAssignmentTable),
		checklistItems: many(buildTaskChecklistItemTable),
		comments: many(buildTaskCommentTable),
		attachments: many(buildTaskAttachmentTable),
		dependencies: many(buildTaskDependencyTable, {
			relationName: "buildTaskDependent",
		}),
		dependents: many(buildTaskDependencyTable, {
			relationName: "buildTaskDependency",
		}),
		activity: many(buildTaskActivityTable),
	}),
);

export const buildTaskDependencyRelations = relations(
	buildTaskDependencyTable,
	({ one }) => ({
		buildTask: one(buildTaskTable, {
			fields: [buildTaskDependencyTable.buildTaskId],
			references: [buildTaskTable.id],
			relationName: "buildTaskDependent",
		}),
		dependsOn: one(buildTaskTable, {
			fields: [buildTaskDependencyTable.dependsOnBuildTaskId],
			references: [buildTaskTable.id],
			relationName: "buildTaskDependency",
		}),
	}),
);

export const buildTaskAssignmentRelations = relations(
	buildTaskAssignmentTable,
	({ one }) => ({
		buildTask: one(buildTaskTable, {
			fields: [buildTaskAssignmentTable.buildTaskId],
			references: [buildTaskTable.id],
		}),
		user: one(userTable, {
			fields: [buildTaskAssignmentTable.userId],
			references: [userTable.id],
			relationName: "buildTaskAssignee",
		}),
		assignedBy: one(userTable, {
			fields: [buildTaskAssignmentTable.assignedById],
			references: [userTable.id],
			relationName: "buildTaskAssigner",
		}),
	}),
);

export const buildTaskChecklistItemRelations = relations(
	buildTaskChecklistItemTable,
	({ one }) => ({
		buildTask: one(buildTaskTable, {
			fields: [buildTaskChecklistItemTable.buildTaskId],
			references: [buildTaskTable.id],
		}),
		completedBy: one(userTable, {
			fields: [buildTaskChecklistItemTable.completedById],
			references: [userTable.id],
		}),
	}),
);

export const buildTaskCommentRelations = relations(
	buildTaskCommentTable,
	({ one }) => ({
		buildTask: one(buildTaskTable, {
			fields: [buildTaskCommentTable.buildTaskId],
			references: [buildTaskTable.id],
		}),
		author: one(userTable, {
			fields: [buildTaskCommentTable.authorId],
			references: [userTable.id],
		}),
	}),
);

export const buildTaskAttachmentRelations = relations(
	buildTaskAttachmentTable,
	({ one }) => ({
		buildTask: one(buildTaskTable, {
			fields: [buildTaskAttachmentTable.buildTaskId],
			references: [buildTaskTable.id],
		}),
		templateDocument: one(templateTaskDocumentTable, {
			fields: [buildTaskAttachmentTable.templateDocumentId],
			references: [templateTaskDocumentTable.id],
		}),
		uploadedBy: one(userTable, {
			fields: [buildTaskAttachmentTable.uploadedById],
			references: [userTable.id],
		}),
	}),
);

export const buildTaskActivityRelations = relations(
	buildTaskActivityTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [buildTaskActivityTable.organizationId],
			references: [organizationTable.id],
		}),
		build: one(buildTable, {
			fields: [buildTaskActivityTable.buildId],
			references: [buildTable.id],
		}),
		buildTask: one(buildTaskTable, {
			fields: [buildTaskActivityTable.buildTaskId],
			references: [buildTaskTable.id],
		}),
		actor: one(userTable, {
			fields: [buildTaskActivityTable.actorId],
			references: [userTable.id],
		}),
	}),
);

export const revisionRelations = relations(revisionTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [revisionTable.organizationId],
		references: [organizationTable.id],
	}),
	changedBy: one(userTable, {
		fields: [revisionTable.changedById],
		references: [userTable.id],
	}),
}));
