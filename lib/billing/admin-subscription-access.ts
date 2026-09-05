import "server-only";
import type Stripe from "stripe";

import {
	createExtendTrialParams,
	createGrantTrialParams,
	isCurrentSubscriptionStatus,
} from "@/lib/billing/admin-subscription-access-logic";
import { getOrCreateStripeCustomer } from "@/lib/billing/customer";
import { getPriceByStripePriceId } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";

export class AdminSubscriptionAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AdminSubscriptionAccessError";
	}
}

function getCustomerId(
	customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): string {
	return typeof customer === "string" ? customer : customer.id;
}

export async function grantOrganizationTrial(params: {
	organizationId: string;
	organizationName: string;
	memberCount: number;
	stripePriceId: string;
	trialDays: number;
	requestId: string;
}): Promise<Stripe.Subscription> {
	const configuredPrice = getPriceByStripePriceId(params.stripePriceId);
	if (!configuredPrice || configuredPrice.price.type !== "recurring") {
		throw new AdminSubscriptionAccessError(
			"Select a configured recurring subscription price.",
		);
	}

	const customer = await getOrCreateStripeCustomer({
		organizationId: params.organizationId,
		organizationName: params.organizationName,
	});
	const stripe = getStripe();
	const subscriptions = await stripe.subscriptions.list({
		customer: customer.id,
		status: "all",
		limit: 100,
	});

	if (
		subscriptions.data.some((subscription) =>
			isCurrentSubscriptionStatus(subscription.status),
		)
	) {
		throw new AdminSubscriptionAccessError(
			"This organization already has a current Stripe subscription.",
		);
	}

	return stripe.subscriptions.create(
		createGrantTrialParams({
			organizationId: params.organizationId,
			stripeCustomerId: customer.id,
			stripePriceId: params.stripePriceId,
			memberCount: params.memberCount,
			seatBased: configuredPrice.price.seatBased === true,
			trialDays: params.trialDays,
		}),
		{
			idempotencyKey: `admin-trial-grant-${params.organizationId}-${params.requestId}`,
		},
	);
}

export async function extendOrganizationTrial(params: {
	subscriptionId: string;
	stripeCustomerId: string;
	additionalDays: number;
	requestId: string;
	now?: Date;
}): Promise<Stripe.Subscription> {
	const stripe = getStripe();
	const subscription = await stripe.subscriptions.retrieve(
		params.subscriptionId,
	);

	if (getCustomerId(subscription.customer) !== params.stripeCustomerId) {
		throw new AdminSubscriptionAccessError(
			"The subscription does not belong to this organization.",
		);
	}
	if (subscription.status !== "trialing" || !subscription.trial_end) {
		throw new AdminSubscriptionAccessError(
			"Only an active trial can be extended.",
		);
	}

	return stripe.subscriptions.update(
		params.subscriptionId,
		createExtendTrialParams({
			currentTrialEnd: new Date(subscription.trial_end * 1000),
			additionalDays: params.additionalDays,
			now: params.now,
		}),
		{
			idempotencyKey: `admin-trial-extend-${params.subscriptionId}-${params.requestId}`,
		},
	);
}

export async function reactivateOrganizationSubscription(params: {
	subscriptionId: string;
	stripeCustomerId: string;
	requestId: string;
}): Promise<Stripe.Subscription> {
	const stripe = getStripe();
	const subscription = await stripe.subscriptions.retrieve(
		params.subscriptionId,
	);

	if (getCustomerId(subscription.customer) !== params.stripeCustomerId) {
		throw new AdminSubscriptionAccessError(
			"The subscription does not belong to this organization.",
		);
	}
	if (
		!subscription.cancel_at_period_end ||
		subscription.status === "canceled"
	) {
		throw new AdminSubscriptionAccessError(
			"Only a current subscription scheduled for cancellation can be reactivated.",
		);
	}

	return stripe.subscriptions.update(
		params.subscriptionId,
		{ cancel_at_period_end: false },
		{
			idempotencyKey: `admin-subscription-reactivate-${params.subscriptionId}-${params.requestId}`,
		},
	);
}
