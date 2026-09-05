import type Stripe from "stripe";

const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
	"canceled",
	"incomplete_expired",
]);

export function isCurrentSubscriptionStatus(
	status: Stripe.Subscription.Status,
): boolean {
	return !TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

export function calculateExtendedTrialEnd(params: {
	currentTrialEnd: Date | null;
	additionalDays: number;
	now?: Date;
}): Date {
	const now = params.now ?? new Date();
	const base = Math.max(now.getTime(), params.currentTrialEnd?.getTime() ?? 0);
	return new Date(base + params.additionalDays * 24 * 60 * 60 * 1000);
}

export function createGrantTrialParams(params: {
	organizationId: string;
	stripeCustomerId: string;
	stripePriceId: string;
	memberCount: number;
	seatBased: boolean;
	trialDays: number;
}): Stripe.SubscriptionCreateParams {
	return {
		customer: params.stripeCustomerId,
		items: [
			{
				price: params.stripePriceId,
				quantity: params.seatBased
					? Math.max(1, params.memberCount)
					: undefined,
			},
		],
		trial_period_days: params.trialDays,
		trial_settings: {
			end_behavior: { missing_payment_method: "cancel" },
		},
		metadata: {
			organizationId: params.organizationId,
			accessGrantedByAdmin: "true",
		},
	};
}

export function createExtendTrialParams(params: {
	currentTrialEnd: Date;
	additionalDays: number;
	now?: Date;
}): Stripe.SubscriptionUpdateParams {
	const trialEnd = calculateExtendedTrialEnd(params);
	return {
		trial_end: Math.floor(trialEnd.getTime() / 1000),
		proration_behavior: "none",
	};
}
