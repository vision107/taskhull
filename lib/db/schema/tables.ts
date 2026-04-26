import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import {
	ActivityType,
	BillingInterval,
	CreditTransactionType,
	DependencyType,
	enumToPgEnum,
	InvitationStatus,
	MemberRole,
	OrderStatus,
	PriceModel,
	PriceType,
	ProjectRole,
	ProjectStatus,
	SubscriptionStatus,
	TaskPriority,
	TaskStatusType,
	UserRole,
} from "./enums";

export const accountTable = pgTable(
	"account",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		password: text("password"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("account_user_id_idx").on(table.userId),
		uniqueIndex("account_provider_account_idx").on(
			table.providerId,
			table.accountId,
		),
	],
);

export const invitationTable = pgTable(
	"invitation",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role", { enum: enumToPgEnum(MemberRole) })
			.$type<MemberRole>()
			.notNull()
			.default(MemberRole.member),
		status: text("status", { enum: enumToPgEnum(InvitationStatus) })
			.$type<InvitationStatus>()
			.notNull()
			.default(InvitationStatus.pending),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		inviterId: uuid("inviter_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("invitation_organization_id_idx").on(table.organizationId),
		index("invitation_email_idx").on(table.email),
		index("invitation_status_idx").on(table.status),
		index("invitation_expires_at_idx").on(table.expiresAt),
		index("invitation_inviter_id_idx").on(table.inviterId),
	],
);

export const memberTable = pgTable(
	"member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: text("role", { enum: enumToPgEnum(MemberRole) })
			.$type<MemberRole>()
			.notNull()
			.default(MemberRole.member),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("member_user_org_idx").on(table.userId, table.organizationId),
		index("member_organization_id_idx").on(table.organizationId),
		index("member_user_id_idx").on(table.userId),
		index("member_role_idx").on(table.role),
	],
);

export const organizationTable = pgTable(
	"organization",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		slug: text("slug"),
		logo: text("logo"),
		metadata: text("metadata"),
		stripeCustomerId: text("stripe_customer_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("organization_slug_idx").on(table.slug),
		index("organization_name_idx").on(table.name),
		index("organization_stripe_customer_id_idx").on(table.stripeCustomerId),
	],
);

export const sessionTable = pgTable(
	"session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		impersonatedBy: uuid("impersonated_by").references(() => userTable.id),
		activeOrganizationId: uuid("active_organization_id"),
		token: text("token").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("session_token_idx").on(table.token),
		index("session_user_id_idx").on(table.userId),
		index("session_expires_at_idx").on(table.expiresAt),
		index("session_active_organization_id_idx").on(table.activeOrganizationId),
	],
);

export const twoFactorTable = pgTable(
	"two_factor",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [uniqueIndex("two_factor_user_id_idx").on(table.userId)],
);

export const userTable = pgTable(
	"user",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		username: text("username").unique(),
		role: text("role", { enum: enumToPgEnum(UserRole) })
			.$type<UserRole>()
			.notNull()
			.default(UserRole.user),
		banned: boolean("banned").default(false),
		banReason: text("ban_reason"),
		banExpires: timestamp("ban_expires", { withTimezone: true }),
		onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
		twoFactorEnabled: boolean("two_factor_enabled").default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("user_email_idx").on(table.email),
		uniqueIndex("user_username_idx").on(table.username),
		index("user_role_idx").on(table.role),
		index("user_banned_idx").on(table.banned),
	],
);

export const verificationTable = pgTable(
	"verification",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("verification_identifier_idx").on(table.identifier),
		index("verification_value_idx").on(table.value),
		index("verification_expires_at_idx").on(table.expiresAt),
	],
);

// ============================================================================
// BILLING TABLES
// ============================================================================

/**
 * Subscription table - stores active subscriptions from Stripe
 * This is a more detailed approach than a simple "order" table,
 * allowing for proper subscription lifecycle management.
 */
export const subscriptionTable = pgTable(
	"subscription",
	{
		id: text("id").primaryKey(), // Stripe subscription ID (sub_xxx)
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull(),
		status: text("status", { enum: enumToPgEnum(SubscriptionStatus) })
			.$type<SubscriptionStatus>()
			.notNull(),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity (for per-seat billing)
		quantity: integer("quantity").notNull().default(1),
		// Billing interval
		interval: text("interval", { enum: enumToPgEnum(BillingInterval) })
			.$type<BillingInterval>()
			.notNull(),
		intervalCount: integer("interval_count").notNull().default(1),
		// Pricing
		unitAmount: integer("unit_amount"), // Amount in cents
		currency: text("currency").notNull().default("usd"),
		// Period dates
		currentPeriodStart: timestamp("current_period_start", {
			withTimezone: true,
		}).notNull(),
		currentPeriodEnd: timestamp("current_period_end", {
			withTimezone: true,
		}).notNull(),
		// Trial dates
		trialStart: timestamp("trial_start", { withTimezone: true }),
		trialEnd: timestamp("trial_end", { withTimezone: true }),
		// Cancellation
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		canceledAt: timestamp("canceled_at", { withTimezone: true }),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("subscription_organization_id_idx").on(table.organizationId),
		index("subscription_stripe_customer_id_idx").on(table.stripeCustomerId),
		index("subscription_status_idx").on(table.status),
		index("subscription_stripe_price_id_idx").on(table.stripePriceId),
		// Composite index for common query: active subscriptions by organization
		index("subscription_org_status_idx").on(table.organizationId, table.status),
	],
);

/**
 * Subscription item table - stores individual line items for a subscription
 * Supports per-seat pricing, metered billing, and multiple prices per subscription
 */
export const subscriptionItemTable = pgTable(
	"subscription_item",
	{
		id: text("id").primaryKey(), // Stripe subscription item ID (si_xxx)
		subscriptionId: text("subscription_id")
			.notNull()
			.references(() => subscriptionTable.id, { onDelete: "cascade" }),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity (for per-seat billing)
		quantity: integer("quantity").notNull().default(1),
		// Price details
		priceAmount: integer("price_amount"), // Amount in cents per unit
		// Pricing model
		priceType: text("price_type", { enum: enumToPgEnum(PriceType) })
			.$type<PriceType>()
			.notNull()
			.default(PriceType.recurring),
		priceModel: text("price_model", { enum: enumToPgEnum(PriceModel) })
			.$type<PriceModel>()
			.notNull()
			.default(PriceModel.flat),
		// Billing interval (for recurring)
		interval: text("interval", {
			enum: enumToPgEnum(BillingInterval),
		}).$type<BillingInterval>(),
		intervalCount: integer("interval_count").default(1),
		// Metered billing
		meterId: text("meter_id"), // Stripe meter ID for usage-based billing
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("subscription_item_subscription_id_idx").on(table.subscriptionId),
		index("subscription_item_stripe_price_id_idx").on(table.stripePriceId),
		index("subscription_item_price_model_idx").on(table.priceModel),
	],
);

/**
 * Order table - stores one-time payments (lifetime deals, credits, etc.)
 * This is the order header; individual items are stored in order_item
 */
export const orderTable = pgTable(
	"order",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		stripeCustomerId: text("stripe_customer_id").notNull(),
		stripePaymentIntentId: text("stripe_payment_intent_id"), // pi_xxx
		stripeCheckoutSessionId: text("stripe_checkout_session_id"), // cs_xxx
		// Totals (sum of all items)
		totalAmount: integer("total_amount").notNull(), // Total amount in cents
		currency: text("currency").notNull().default("usd"),
		// Status
		status: text("status", { enum: enumToPgEnum(OrderStatus) })
			.$type<OrderStatus>()
			.notNull()
			.default(OrderStatus.completed),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("order_organization_id_idx").on(table.organizationId),
		index("order_stripe_customer_id_idx").on(table.stripeCustomerId),
		index("order_status_idx").on(table.status),
		index("order_payment_intent_id_idx").on(table.stripePaymentIntentId),
		index("order_checkout_session_id_idx").on(table.stripeCheckoutSessionId),
	],
);

/**
 * Order item table - stores individual line items for an order
 * Supports multiple products/prices per order
 */
export const orderItemTable = pgTable(
	"order_item",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orderTable.id, { onDelete: "cascade" }),
		// Price/Product info
		stripePriceId: text("stripe_price_id").notNull(),
		stripeProductId: text("stripe_product_id"),
		// Quantity and pricing
		quantity: integer("quantity").notNull().default(1),
		unitAmount: integer("unit_amount").notNull(), // Price per unit in cents
		totalAmount: integer("total_amount").notNull(), // quantity * unitAmount
		// Description (from Stripe line item)
		description: text("description"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("order_item_order_id_idx").on(table.orderId),
		index("order_item_stripe_price_id_idx").on(table.stripePriceId),
	],
);

/**
 * Billing event log - audit trail for all billing events
 * Useful for debugging and customer support
 */
export const billingEventTable = pgTable(
	"billing_event",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id").references(
			() => organizationTable.id,
			{ onDelete: "set null" },
		),
		stripeEventId: text("stripe_event_id").notNull().unique(), // evt_xxx
		eventType: text("event_type").notNull(), // e.g., "customer.subscription.created"
		// Reference to related entities
		subscriptionId: text("subscription_id"),
		orderId: uuid("order_id"),
		// Raw event data for debugging
		eventData: text("event_data"), // JSON stringified
		// Processing status
		processed: boolean("processed").notNull().default(true),
		error: text("error"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("billing_event_organization_id_idx").on(table.organizationId),
		index("billing_event_event_type_idx").on(table.eventType),
		index("billing_event_subscription_id_idx").on(table.subscriptionId),
		index("billing_event_created_at_idx").on(table.createdAt),
	],
);

/**
 * Credit balance per organization
 * Denormalized for fast reads - single row per org
 */
export const creditBalanceTable = pgTable(
	"credit_balance",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.unique()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Current balance (can be large for high-volume orgs)
		balance: integer("balance").notNull().default(0),
		// Lifetime stats for analytics
		lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
		lifetimeGranted: integer("lifetime_granted").notNull().default(0), // Free/promo
		lifetimeUsed: integer("lifetime_used").notNull().default(0),
		lifetimeExpired: integer("lifetime_expired").notNull().default(0),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("credit_balance_organization_id_idx").on(table.organizationId),
	],
);

/**
 * Credit deduction failure log - tracks failed deductions for reconciliation
 * When credit deduction fails after AI response is already sent, we log it here
 */
export const creditDeductionFailureTable = pgTable(
	"credit_deduction_failure",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Amount that should have been deducted
		amount: integer("amount").notNull(),
		// Error details
		errorCode: text("error_code").notNull(), // 'INSUFFICIENT_CREDITS', 'DB_ERROR', etc.
		errorMessage: text("error_message"),
		// Context
		model: text("model"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		referenceType: text("reference_type"), // 'ai_chat', etc.
		referenceId: text("reference_id"),
		// Who triggered the request
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Resolution tracking
		resolved: boolean("resolved").notNull().default(false),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolvedBy: uuid("resolved_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
		resolutionNotes: text("resolution_notes"),
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("credit_deduction_failure_org_idx").on(table.organizationId),
		index("credit_deduction_failure_resolved_idx").on(table.resolved),
		index("credit_deduction_failure_created_idx").on(table.createdAt),
	],
);

/**
 * Credit transaction ledger - immutable audit trail
 * Every credit change is recorded here
 */
export const creditTransactionTable = pgTable(
	"credit_transaction",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		// Transaction type
		type: text("type", { enum: enumToPgEnum(CreditTransactionType) })
			.$type<CreditTransactionType>()
			.notNull(),
		// Amount: positive = add credits, negative = deduct credits
		amount: integer("amount").notNull(),
		// Running balance after this transaction
		balanceAfter: integer("balance_after").notNull(),
		// Description shown to user
		description: text("description"),
		// Reference to source (order, subscription, chat, etc.)
		referenceType: text("reference_type"), // 'order', 'subscription', 'ai_chat', 'admin', etc.
		referenceId: text("reference_id"),
		// AI usage details (for usage transactions)
		model: text("model"), // 'gpt-4o-mini', 'gpt-4o', etc.
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		// Who initiated this transaction
		createdBy: uuid("created_by").references(() => userTable.id, {
			onDelete: "set null",
		}),
		// Metadata for additional context
		metadata: text("metadata"), // JSON stringified
		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("credit_transaction_organization_id_idx").on(table.organizationId),
		index("credit_transaction_type_idx").on(table.type),
		index("credit_transaction_created_at_idx").on(table.createdAt),
		index("credit_transaction_reference_idx").on(
			table.referenceType,
			table.referenceId,
		),
		// Composite for org history queries
		index("credit_transaction_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
		// Composite index for org+type filtering
		index("credit_transaction_org_type_idx").on(
			table.organizationId,
			table.type,
		),
		// Unique constraint for checkout session idempotency (partial index)
		// This prevents double-crediting from webhook retries
		uniqueIndex("credit_transaction_checkout_unique")
			.on(table.referenceType, table.referenceId)
			.where(sql`${table.referenceType} = 'checkout_session'`),
		// Unique constraint for bonus credits idempotency (partial index)
		// This prevents double bonus credits from webhook retries
		uniqueIndex("credit_transaction_bonus_unique")
			.on(table.referenceType, table.referenceId)
			.where(sql`${table.referenceType} = 'checkout_session_bonus'`),
	],
);

// ============================================================================
// AI CHAT TABLE
// ============================================================================

/**
 * AI Chat table - stores chat conversations with AI
 * Supports both user-level and organization-level chats
 * Note: At least one of organizationId or userId must be non-null (enforced by check constraint)
 */
export const aiChatTable = pgTable(
	"ai_chat",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id").references(
			() => organizationTable.id,
			{ onDelete: "cascade" },
		),
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "cascade",
		}),
		title: text("title"),
		messages: text("messages"), // JSON stringified array of messages
		pinned: boolean("pinned").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("ai_chat_organization_id_idx").on(table.organizationId),
		index("ai_chat_user_id_idx").on(table.userId),
		index("ai_chat_created_at_idx").on(table.createdAt),
		// Ensure at least one owner is set - prevent orphaned chats
		check(
			"ai_chat_has_owner",
			sql`${table.organizationId} IS NOT NULL OR ${table.userId} IS NOT NULL`,
		),
	],
);

// ─── Project Management Tables ────────────────────────────────────────────────

/**
 * Projects table - top-level work containers within an organization
 */
export const projectTable = pgTable(
	"project",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		status: text("status", { enum: enumToPgEnum(ProjectStatus) })
			.$type<ProjectStatus>()
			.notNull()
			.default(ProjectStatus.active),
		color: text("color").notNull().default("#6366f1"),
		icon: text("icon"),
		startDate: timestamp("start_date", { withTimezone: true }),
		endDate: timestamp("end_date", { withTimezone: true }),
		// Points to the project this was cloned from (the direct ancestor).
		// Enables series-production chains: Product 1 -> Product 2 -> Product 3.
		templateProjectId: uuid("template_project_id"),
		// True when this project is a reusable "master template" for cloning.
		// Templates can be hidden from the main grid and surfaced separately.
		isTemplate: boolean("is_template").notNull().default(false),
		createdById: uuid("created_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("project_organization_id_idx").on(table.organizationId),
		index("project_status_idx").on(table.status),
		index("project_org_status_idx").on(table.organizationId, table.status),
		index("project_template_project_id_idx").on(table.templateProjectId),
	],
);

/**
 * Per-user favorite projects. Enables pinning projects to the top of the
 * sidebar/navigation. Each (user, project) pair is unique.
 */
export const projectFavoriteTable = pgTable(
	"project_favorite",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projectTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("project_favorite_unique_idx").on(
			table.userId,
			table.projectId,
		),
		index("project_favorite_user_id_idx").on(table.userId),
	],
);

/**
 * Project members - who has access to a project and in what role
 */
export const projectMemberTable = pgTable(
	"project_member",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projectTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: text("role", { enum: enumToPgEnum(ProjectRole) })
			.$type<ProjectRole>()
			.notNull()
			.default(ProjectRole.member),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("project_member_unique_idx").on(table.projectId, table.userId),
		index("project_member_project_id_idx").on(table.projectId),
		index("project_member_user_id_idx").on(table.userId),
	],
);

/**
 * Task statuses - per-project configurable statuses (e.g. "To Do", "In Progress", "Done")
 */
export const taskStatusTable = pgTable(
	"task_status",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projectTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color").notNull().default("#94a3b8"),
		type: text("type", { enum: enumToPgEnum(TaskStatusType) })
			.$type<TaskStatusType>()
			.notNull()
			.default(TaskStatusType.todo),
		order: smallint("order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("task_status_project_id_idx").on(table.projectId),
		index("task_status_project_order_idx").on(table.projectId, table.order),
	],
);

/**
 * Labels - color tags that can be attached to tasks
 */
export const labelTable = pgTable(
	"label",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projectTable.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color").notNull().default("#94a3b8"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("label_project_id_idx").on(table.projectId),
		uniqueIndex("label_project_name_idx").on(table.projectId, table.name),
	],
);

/**
 * Tasks - core work item (inspired by Plane's issue model)
 */
export const taskTable = pgTable(
	"task",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projectTable.id, { onDelete: "cascade" }),
		statusId: uuid("status_id").references(() => taskStatusTable.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		description: jsonb("description"),
		priority: text("priority", { enum: enumToPgEnum(TaskPriority) })
			.$type<TaskPriority>()
			.notNull()
			.default(TaskPriority.none),
		assigneeId: uuid("assignee_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		parentId: uuid("parent_id"),
		// Points to the originating task in the template / ancestor project.
		// Preserved during project clone so that "Drill holes" in Product 2
		// knows it's a clone of "Drill holes" in Product 1. Walk the chain to
		// find the shared ancestor.
		templateTaskId: uuid("template_task_id"),
		startDate: timestamp("start_date", { withTimezone: true }),
		dueDate: timestamp("due_date", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		actualHours: doublePrecision("actual_hours"),
		estimatedHours: doublePrecision("estimated_hours"),
		sequenceId: integer("sequence_id").notNull().default(0),
		sortOrder: doublePrecision("sort_order").notNull().default(0),
		createdById: uuid("created_by_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("task_project_id_idx").on(table.projectId),
		index("task_status_id_idx").on(table.statusId),
		index("task_assignee_id_idx").on(table.assigneeId),
		index("task_parent_id_idx").on(table.parentId),
		index("task_template_task_id_idx").on(table.templateTaskId),
		index("task_due_date_idx").on(table.dueDate),
		index("task_start_date_idx").on(table.startDate),
		index("task_project_sequence_idx").on(table.projectId, table.sequenceId),
		index("task_project_sort_idx").on(table.projectId, table.sortOrder),
	],
);

/**
 * Task labels - many-to-many between tasks and labels
 */
export const taskLabelTable = pgTable(
	"task_label",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		taskId: uuid("task_id")
			.notNull()
			.references(() => taskTable.id, { onDelete: "cascade" }),
		labelId: uuid("label_id")
			.notNull()
			.references(() => labelTable.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("task_label_unique_idx").on(table.taskId, table.labelId),
		index("task_label_task_id_idx").on(table.taskId),
	],
);

/**
 * Task dependencies - Gantt dependency edges between tasks
 */
export const taskDependencyTable = pgTable(
	"task_dependency",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		predecessorId: uuid("predecessor_id")
			.notNull()
			.references(() => taskTable.id, { onDelete: "cascade" }),
		successorId: uuid("successor_id")
			.notNull()
			.references(() => taskTable.id, { onDelete: "cascade" }),
		type: text("type", { enum: enumToPgEnum(DependencyType) })
			.$type<DependencyType>()
			.notNull()
			.default(DependencyType.finishToStart),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("task_dependency_unique_idx").on(
			table.predecessorId,
			table.successorId,
		),
		index("task_dependency_predecessor_idx").on(table.predecessorId),
		index("task_dependency_successor_idx").on(table.successorId),
	],
);

/**
 * Task comments - threaded comments on tasks
 */
export const taskCommentTable = pgTable(
	"task_comment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		taskId: uuid("task_id")
			.notNull()
			.references(() => taskTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		content: jsonb("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("task_comment_task_id_idx").on(table.taskId),
		index("task_comment_user_id_idx").on(table.userId),
		index("task_comment_created_at_idx").on(table.taskId, table.createdAt),
	],
);

/**
 * Task attachments - files attached to tasks (stored in S3)
 */
export const taskAttachmentTable = pgTable(
	"task_attachment",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		taskId: uuid("task_id")
			.notNull()
			.references(() => taskTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		fileName: text("file_name").notNull(),
		fileKey: text("file_key").notNull(),
		fileSize: integer("file_size"),
		mimeType: text("mime_type"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("task_attachment_task_id_idx").on(table.taskId),
	],
);

/**
 * Task activities - audit log for all task changes
 */
export const taskActivityTable = pgTable(
	"task_activity",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		taskId: uuid("task_id")
			.notNull()
			.references(() => taskTable.id, { onDelete: "cascade" }),
		userId: uuid("user_id").references(() => userTable.id, {
			onDelete: "set null",
		}),
		type: text("type", { enum: enumToPgEnum(ActivityType) })
			.$type<ActivityType>()
			.notNull(),
		oldValue: text("old_value"),
		newValue: text("new_value"),
		meta: jsonb("meta"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("task_activity_task_id_idx").on(table.taskId),
		index("task_activity_task_created_idx").on(table.taskId, table.createdAt),
	],
);
