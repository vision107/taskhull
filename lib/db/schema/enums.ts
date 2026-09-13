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

export function enumToPgEnum<T extends Record<string, string>>(myEnum: T) {
	return Object.values(myEnum).map((value) => value) as [
		T[keyof T],
		...T[keyof T][],
	];
}

// -------------------------- Manufacturing --------------------------

// Template version lifecycle. Only `draft` versions are editable.
export const TemplateVersionStatus = {
	draft: "draft",
	published: "published",
	archived: "archived",
} as const;
export type TemplateVersionStatus =
	(typeof TemplateVersionStatus)[keyof typeof TemplateVersionStatus];
export const TemplateVersionStatuses = Object.values(TemplateVersionStatus);

// Build (one manufactured unit) lifecycle
export const BuildStatus = {
	planned: "planned",
	active: "active",
	blocked: "blocked",
	completed: "completed",
	archived: "archived",
} as const;
export type BuildStatus = (typeof BuildStatus)[keyof typeof BuildStatus];
export const BuildStatuses = Object.values(BuildStatus);

// Build task lifecycle
export const BuildTaskStatus = {
	todo: "todo",
	inProgress: "in_progress",
	blocked: "blocked",
	review: "review",
	done: "done",
} as const;
export type BuildTaskStatus =
	(typeof BuildTaskStatus)[keyof typeof BuildTaskStatus];
export const BuildTaskStatuses = Object.values(BuildTaskStatus);

// Role of a user on a build task
export const BuildTaskAssignmentRole = {
	owner: "owner",
	helper: "helper",
	reviewer: "reviewer",
} as const;
export type BuildTaskAssignmentRole =
	(typeof BuildTaskAssignmentRole)[keyof typeof BuildTaskAssignmentRole];
export const BuildTaskAssignmentRoles = Object.values(BuildTaskAssignmentRole);

// Checklist item state
export const ChecklistItemStatus = {
	open: "open",
	done: "done",
	skipped: "skipped",
} as const;
export type ChecklistItemStatus =
	(typeof ChecklistItemStatus)[keyof typeof ChecklistItemStatus];
export const ChecklistItemStatuses = Object.values(ChecklistItemStatus);

// Entities tracked by the generic revision (audit) log
export const RevisionEntity = {
	template: "template",
	templateVersion: "template_version",
	templateTask: "template_task",
	product: "product",
	build: "build",
	buildTask: "build_task",
} as const;
export type RevisionEntity =
	(typeof RevisionEntity)[keyof typeof RevisionEntity];
export const RevisionEntities = Object.values(RevisionEntity);

export const RevisionAction = {
	create: "create",
	update: "update",
	delete: "delete",
	publish: "publish",
} as const;
export type RevisionAction =
	(typeof RevisionAction)[keyof typeof RevisionAction];
export const RevisionActions = Object.values(RevisionAction);
