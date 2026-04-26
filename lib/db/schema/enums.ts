// Invitation status enum (matches Better Auth)
export const InvitationStatus = {
	pending: "pending",
	accepted: "accepted",
	rejected: "rejected",
	canceled: "canceled",
} as const;
export type InvitationStatus =
	(typeof InvitationStatus)[keyof typeof InvitationStatus];
export const InvitationStatuses = Object.values(InvitationStatus);

// Member role enum
export const MemberRole = {
	owner: "owner",
	admin: "admin",
	member: "member",
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];
export const MemberRoles = Object.values(MemberRole);

// User role enum
export const UserRole = {
	user: "user",
	admin: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const UserRoles = Object.values(UserRole);

// Order type enum (for billing)
export const OrderType = {
	subscription: "subscription",
	oneTime: "one_time",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];
export const OrderTypes = Object.values(OrderType);

// Subscription status enum (matches Stripe subscription statuses)
export const SubscriptionStatus = {
	active: "active",
	canceled: "canceled",
	incomplete: "incomplete",
	incompleteExpired: "incomplete_expired",
	pastDue: "past_due",
	paused: "paused",
	trialing: "trialing",
	unpaid: "unpaid",
} as const;
export type SubscriptionStatus =
	(typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const SubscriptionStatuses = Object.values(SubscriptionStatus);

// Billing interval enum
export const BillingInterval = {
	month: "month",
	year: "year",
	week: "week",
	day: "day",
} as const;
export type BillingInterval =
	(typeof BillingInterval)[keyof typeof BillingInterval];
export const BillingIntervals = Object.values(BillingInterval);

// Price type enum (recurring vs one-time)
export const PriceType = {
	recurring: "recurring",
	oneTime: "one_time",
} as const;
export type PriceType = (typeof PriceType)[keyof typeof PriceType];
export const PriceTypes = Object.values(PriceType);

// Price model enum (flat, per-seat, metered)
export const PriceModel = {
	flat: "flat",
	perSeat: "per_seat",
	metered: "metered",
} as const;
export type PriceModel = (typeof PriceModel)[keyof typeof PriceModel];
export const PriceModels = Object.values(PriceModel);

// Order status enum (for one-time payments)
export const OrderStatus = {
	pending: "pending",
	completed: "completed",
	failed: "failed",
	refunded: "refunded",
	partiallyRefunded: "partially_refunded",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const OrderStatuses = Object.values(OrderStatus);

// Credit transaction type enum
export const CreditTransactionType = {
	purchase: "purchase", // User bought credits
	subscriptionGrant: "subscription_grant", // Monthly subscription allocation
	bonus: "bonus", // Bonus from package purchase
	promo: "promo", // Promotional credits (coupon, referral)
	usage: "usage", // Credits consumed by AI
	refund: "refund", // Credits refunded
	expire: "expire", // Credits expired
	adjustment: "adjustment", // Manual admin adjustment
} as const;
export type CreditTransactionType =
	(typeof CreditTransactionType)[keyof typeof CreditTransactionType];
export const CreditTransactionTypes = Object.values(CreditTransactionType);

// ─── Project Management Enums ────────────────────────────────────────────────

export const ProjectStatus = {
	active: "active",
	paused: "paused",
	completed: "completed",
	archived: "archived",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export const ProjectStatuses = Object.values(ProjectStatus);

export const ProjectRole = {
	manager: "manager",
	member: "member",
	viewer: "viewer",
} as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];
export const ProjectRoles = Object.values(ProjectRole);

export const TaskPriority = {
	none: "none",
	low: "low",
	medium: "medium",
	high: "high",
	urgent: "urgent",
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
export const TaskPriorities = Object.values(TaskPriority);

export const TaskStatusType = {
	todo: "todo",
	inProgress: "in_progress",
	done: "done",
	cancelled: "cancelled",
} as const;
export type TaskStatusType =
	(typeof TaskStatusType)[keyof typeof TaskStatusType];
export const TaskStatusTypes = Object.values(TaskStatusType);

export const DependencyType = {
	finishToStart: "finish_to_start",
	startToStart: "start_to_start",
	finishToFinish: "finish_to_finish",
	startToFinish: "start_to_finish",
} as const;
export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];
export const DependencyTypes = Object.values(DependencyType);

export const ActivityType = {
	created: "created",
	statusChanged: "status_changed",
	priorityChanged: "priority_changed",
	assigneeChanged: "assignee_changed",
	titleChanged: "title_changed",
	descriptionChanged: "description_changed",
	dueDateChanged: "due_date_changed",
	startDateChanged: "start_date_changed",
	labelAdded: "label_added",
	labelRemoved: "label_removed",
	commentAdded: "comment_added",
	attachmentAdded: "attachment_added",
	attachmentRemoved: "attachment_removed",
	completed: "completed",
	reopened: "reopened",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];
export const ActivityTypes = Object.values(ActivityType);

// ─────────────────────────────────────────────────────────────────────────────

export function enumToPgEnum<T extends Record<string, string>>(myEnum: T) {
	return Object.values(myEnum).map((value) => value) as [
		T[keyof T],
		...T[keyof T][],
	];
}
