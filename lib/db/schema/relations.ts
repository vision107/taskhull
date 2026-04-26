import { relations } from "drizzle-orm";
import {
	accountTable,
	aiChatTable,
	billingEventTable,
	creditBalanceTable,
	creditDeductionFailureTable,
	creditTransactionTable,
	invitationTable,
	labelTable,
	memberTable,
	orderItemTable,
	orderTable,
	organizationTable,
	projectFavoriteTable,
	projectMemberTable,
	projectTable,
	sessionTable,
	subscriptionItemTable,
	subscriptionTable,
	taskActivityTable,
	taskAttachmentTable,
	taskCommentTable,
	taskDependencyTable,
	taskLabelTable,
	taskStatusTable,
	taskTable,
	twoFactorTable,
	userTable,
} from "./tables";

export const accountRelations = relations(accountTable, ({ one }) => ({
	user: one(userTable, {
		fields: [accountTable.userId],
		references: [userTable.id],
	}),
}));

export const invitationRelations = relations(invitationTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [invitationTable.organizationId],
		references: [organizationTable.id],
	}),
	inviter: one(userTable, {
		fields: [invitationTable.inviterId],
		references: [userTable.id],
	}),
}));

export const memberRelations = relations(memberTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [memberTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [memberTable.userId],
		references: [userTable.id],
	}),
}));

export const organizationRelations = relations(
	organizationTable,
	({ one, many }) => ({
		members: many(memberTable),
		invitations: many(invitationTable),
		subscriptions: many(subscriptionTable),
		orders: many(orderTable),
		billingEvents: many(billingEventTable),
		aiChats: many(aiChatTable),
		creditBalance: one(creditBalanceTable),
		creditTransactions: many(creditTransactionTable),
		projects: many(projectTable),
	}),
);

export const sessionRelations = relations(sessionTable, ({ one }) => ({
	user: one(userTable, {
		fields: [sessionTable.userId],
		references: [userTable.id],
	}),
}));

export const twoFactorRelations = relations(twoFactorTable, ({ one }) => ({
	user: one(userTable, {
		fields: [twoFactorTable.userId],
		references: [userTable.id],
	}),
}));

export const userRelations = relations(userTable, ({ many }) => ({
	sessions: many(sessionTable),
	accounts: many(accountTable),
	invitations: many(invitationTable),
	memberships: many(memberTable),
	twoFactors: many(twoFactorTable),
	aiChats: many(aiChatTable),
	creditTransactions: many(creditTransactionTable),
	projectMemberships: many(projectMemberTable),
	projectFavorites: many(projectFavoriteTable),
	assignedTasks: many(taskTable, { relationName: "taskAssignee" }),
	createdTasks: many(taskTable, { relationName: "taskCreator" }),
	taskComments: many(taskCommentTable),
}));

// Billing relations
export const subscriptionRelations = relations(
	subscriptionTable,
	({ one, many }) => ({
		organization: one(organizationTable, {
			fields: [subscriptionTable.organizationId],
			references: [organizationTable.id],
		}),
		items: many(subscriptionItemTable),
	}),
);

export const subscriptionItemRelations = relations(
	subscriptionItemTable,
	({ one }) => ({
		subscription: one(subscriptionTable, {
			fields: [subscriptionItemTable.subscriptionId],
			references: [subscriptionTable.id],
		}),
	}),
);

export const orderRelations = relations(orderTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [orderTable.organizationId],
		references: [organizationTable.id],
	}),
	items: many(orderItemTable),
}));

export const orderItemRelations = relations(orderItemTable, ({ one }) => ({
	order: one(orderTable, {
		fields: [orderItemTable.orderId],
		references: [orderTable.id],
	}),
}));

export const billingEventRelations = relations(
	billingEventTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [billingEventTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

// AI Chat relations
export const aiChatRelations = relations(aiChatTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [aiChatTable.organizationId],
		references: [organizationTable.id],
	}),
	user: one(userTable, {
		fields: [aiChatTable.userId],
		references: [userTable.id],
	}),
}));

// Credit relations
export const creditBalanceRelations = relations(
	creditBalanceTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditBalanceTable.organizationId],
			references: [organizationTable.id],
		}),
	}),
);

export const creditTransactionRelations = relations(
	creditTransactionTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditTransactionTable.organizationId],
			references: [organizationTable.id],
		}),
		createdByUser: one(userTable, {
			fields: [creditTransactionTable.createdBy],
			references: [userTable.id],
		}),
	}),
);

export const creditDeductionFailureRelations = relations(
	creditDeductionFailureTable,
	({ one }) => ({
		organization: one(organizationTable, {
			fields: [creditDeductionFailureTable.organizationId],
			references: [organizationTable.id],
		}),
		user: one(userTable, {
			fields: [creditDeductionFailureTable.userId],
			references: [userTable.id],
			relationName: "deductionFailureUser",
		}),
		resolvedByUser: one(userTable, {
			fields: [creditDeductionFailureTable.resolvedBy],
			references: [userTable.id],
			relationName: "deductionFailureResolvedBy",
		}),
	}),
);

// ─── Project Management Relations ─────────────────────────────────────────────

export const projectRelations = relations(projectTable, ({ one, many }) => ({
	organization: one(organizationTable, {
		fields: [projectTable.organizationId],
		references: [organizationTable.id],
	}),
	createdBy: one(userTable, {
		fields: [projectTable.createdById],
		references: [userTable.id],
	}),
	templateProject: one(projectTable, {
		fields: [projectTable.templateProjectId],
		references: [projectTable.id],
		relationName: "projectTemplate",
	}),
	clones: many(projectTable, { relationName: "projectTemplate" }),
	members: many(projectMemberTable),
	taskStatuses: many(taskStatusTable),
	tasks: many(taskTable),
	labels: many(labelTable),
	favorites: many(projectFavoriteTable),
}));

export const projectFavoriteRelations = relations(
	projectFavoriteTable,
	({ one }) => ({
		project: one(projectTable, {
			fields: [projectFavoriteTable.projectId],
			references: [projectTable.id],
		}),
		user: one(userTable, {
			fields: [projectFavoriteTable.userId],
			references: [userTable.id],
		}),
	}),
);

export const projectMemberRelations = relations(
	projectMemberTable,
	({ one }) => ({
		project: one(projectTable, {
			fields: [projectMemberTable.projectId],
			references: [projectTable.id],
		}),
		user: one(userTable, {
			fields: [projectMemberTable.userId],
			references: [userTable.id],
		}),
	}),
);

export const taskStatusRelations = relations(
	taskStatusTable,
	({ one, many }) => ({
		project: one(projectTable, {
			fields: [taskStatusTable.projectId],
			references: [projectTable.id],
		}),
		tasks: many(taskTable),
	}),
);

export const labelRelations = relations(labelTable, ({ one, many }) => ({
	project: one(projectTable, {
		fields: [labelTable.projectId],
		references: [projectTable.id],
	}),
	taskLabels: many(taskLabelTable),
}));

export const taskRelations = relations(taskTable, ({ one, many }) => ({
	project: one(projectTable, {
		fields: [taskTable.projectId],
		references: [projectTable.id],
	}),
	status: one(taskStatusTable, {
		fields: [taskTable.statusId],
		references: [taskStatusTable.id],
	}),
	assignee: one(userTable, {
		fields: [taskTable.assigneeId],
		references: [userTable.id],
		relationName: "taskAssignee",
	}),
	createdBy: one(userTable, {
		fields: [taskTable.createdById],
		references: [userTable.id],
		relationName: "taskCreator",
	}),
	parent: one(taskTable, {
		fields: [taskTable.parentId],
		references: [taskTable.id],
		relationName: "subtasks",
	}),
	subtasks: many(taskTable, { relationName: "subtasks" }),
	templateTask: one(taskTable, {
		fields: [taskTable.templateTaskId],
		references: [taskTable.id],
		relationName: "taskTemplate",
	}),
	clones: many(taskTable, { relationName: "taskTemplate" }),
	labels: many(taskLabelTable),
	comments: many(taskCommentTable),
	attachments: many(taskAttachmentTable),
	activities: many(taskActivityTable),
	predecessorDependencies: many(taskDependencyTable, {
		relationName: "dependencySuccessor",
	}),
	successorDependencies: many(taskDependencyTable, {
		relationName: "dependencyPredecessor",
	}),
}));

export const taskLabelRelations = relations(taskLabelTable, ({ one }) => ({
	task: one(taskTable, {
		fields: [taskLabelTable.taskId],
		references: [taskTable.id],
	}),
	label: one(labelTable, {
		fields: [taskLabelTable.labelId],
		references: [labelTable.id],
	}),
}));

export const taskDependencyRelations = relations(
	taskDependencyTable,
	({ one }) => ({
		predecessor: one(taskTable, {
			fields: [taskDependencyTable.predecessorId],
			references: [taskTable.id],
			relationName: "dependencyPredecessor",
		}),
		successor: one(taskTable, {
			fields: [taskDependencyTable.successorId],
			references: [taskTable.id],
			relationName: "dependencySuccessor",
		}),
	}),
);

export const taskCommentRelations = relations(taskCommentTable, ({ one }) => ({
	task: one(taskTable, {
		fields: [taskCommentTable.taskId],
		references: [taskTable.id],
	}),
	user: one(userTable, {
		fields: [taskCommentTable.userId],
		references: [userTable.id],
	}),
}));

export const taskAttachmentRelations = relations(
	taskAttachmentTable,
	({ one }) => ({
		task: one(taskTable, {
			fields: [taskAttachmentTable.taskId],
			references: [taskTable.id],
		}),
		user: one(userTable, {
			fields: [taskAttachmentTable.userId],
			references: [userTable.id],
		}),
	}),
);

export const taskActivityRelations = relations(
	taskActivityTable,
	({ one }) => ({
		task: one(taskTable, {
			fields: [taskActivityTable.taskId],
			references: [taskTable.id],
		}),
		user: one(userTable, {
			fields: [taskActivityTable.userId],
			references: [userTable.id],
		}),
	}),
);
