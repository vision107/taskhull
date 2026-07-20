import { relations } from "drizzle-orm";

import {
	accountTable,
	aiChatTable,
	billingEventTable,
	creditBalanceTable,
	creditDeductionFailureTable,
	creditTransactionTable,
	invitationTable,
	leadTable,
	memberTable,
	orderItemTable,
	orderTable,
	organizationTable,
	sessionTable,
	subscriptionItemTable,
	subscriptionTable,
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
		leads: many(leadTable),
		creditBalance: one(creditBalanceTable),
		creditTransactions: many(creditTransactionTable),
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
	assignedLeads: many(leadTable),
	creditTransactions: many(creditTransactionTable),
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

// Lead relations
export const leadRelations = relations(leadTable, ({ one }) => ({
	organization: one(organizationTable, {
		fields: [leadTable.organizationId],
		references: [organizationTable.id],
	}),
	assignedTo: one(userTable, {
		fields: [leadTable.assignedToId],
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
