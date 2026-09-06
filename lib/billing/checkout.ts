import "server-only";
import type Stripe from "stripe";

import { creditPackages } from "@/config/billing.config";
import { getPriceByStripePriceId } from "@/lib/billing/plans";
import type { CheckoutColorScheme, CheckoutResult } from "@/lib/billing/types";
import { env } from "@/lib/env";

import { buildCheckoutMetadata } from "./checkout-metadata";
import { getOrCreateStripeCustomer } from "./customer";
import { getStripe } from "./stripe";
import type { CreateCheckoutParams } from "./types";

export type StripeCheckoutMode = "embedded" | "hosted";

export function buildCheckoutBrandingSettings(
	colorScheme: CheckoutColorScheme = "light",
): Stripe.Checkout.SessionCreateParams.BrandingSettings {
	return colorScheme === "dark"
		? {
				background_color: "#18181b",
				button_color: "#fafafa",
				border_style: "rounded",
				font_family: "inter",
			}
		: {
				background_color: "#ffffff",
				button_color: "#18181b",
				border_style: "rounded",
				font_family: "inter",
			};
}

export function buildCheckoutIdempotencyKey({
	organizationId,
	stripePriceId,
	quantity,
	checkoutMode,
	colorScheme = "light",
	timestamp = Date.now(),
}: {
	organizationId: string;
	stripePriceId: string;
	quantity: number;
	checkoutMode: StripeCheckoutMode;
	colorScheme?: CheckoutColorScheme;
	timestamp?: number;
}): string {
	const IDEMPOTENCY_WINDOW_MS = 60 * 1000;
	const window = Math.floor(timestamp / IDEMPOTENCY_WINDOW_MS);

	return `checkout-${organizationId}-${stripePriceId}-${quantity}-${checkoutMode}-${colorScheme}-${window}`;
}

export function buildCheckoutRedirectParams(
	checkoutMode: StripeCheckoutMode,
	successUrl: string,
	cancelUrl: string,
): Pick<
	Stripe.Checkout.SessionCreateParams,
	"cancel_url" | "return_url" | "success_url" | "ui_mode"
> {
	if (checkoutMode === "embedded") {
		return {
			ui_mode: "embedded",
			return_url: successUrl,
		};
	}

	return {
		ui_mode: "hosted",
		success_url: successUrl,
		cancel_url: cancelUrl,
	};
}

export function buildCheckoutResult(
	checkoutMode: StripeCheckoutMode,
	session: Pick<Stripe.Checkout.Session, "client_secret" | "id" | "url">,
): CheckoutResult {
	if (checkoutMode === "embedded") {
		if (!session.client_secret) {
			throw new Error(
				"Failed to create embedded checkout session: no client secret returned",
			);
		}

		return {
			mode: "embedded",
			clientSecret: session.client_secret,
			sessionId: session.id,
		};
	}

	if (!session.url) {
		throw new Error(
			"Failed to create hosted checkout session: no URL returned",
		);
	}

	return {
		mode: "hosted",
		url: session.url,
		sessionId: session.id,
	};
}

/**
 * Create a Stripe Checkout session for a subscription or one-time order.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckoutSession(
	params: CreateCheckoutParams,
): Promise<CheckoutResult> {
	const {
		organizationId,
		stripePriceId,
		successUrl,
		cancelUrl,
		stripeCustomerId,
		email,
		quantity = 1,
		trialDays,
		colorScheme,
		metadata = {},
	} = params;

	const stripe = getStripe();

	// Look up the price configuration
	let priceConfig = getPriceByStripePriceId(stripePriceId);

	if (!priceConfig) {
		// Check if it's a credit package
		const creditPackage = creditPackages.find(
			(p) => p.stripePriceId === stripePriceId,
		);

		if (creditPackage) {
			priceConfig = {
				plan: {
					id: creditPackage.id,
					name: creditPackage.name,
					description: creditPackage.description,
					features: [],
				} as any,
				price: {
					id: creditPackage.id,
					stripePriceId: creditPackage.stripePriceId,
					amount: creditPackage.priceAmount,
					currency: creditPackage.currency,
					type: "one_time",
				},
			};
		}
	}

	if (!priceConfig) {
		throw new Error(`Price configuration not found for ${stripePriceId}`);
	}

	const { price, plan } = priceConfig;
	const isSubscription = price.type === "recurring";

	// Build line items
	const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
		{
			price: stripePriceId,
			quantity,
		},
	];

	// Determine mode based on price type
	const mode: Stripe.Checkout.SessionCreateParams.Mode = isSubscription
		? "subscription"
		: "payment";

	// Build session params
	const checkoutMode = env.STRIPE_CHECKOUT_MODE;
	if (checkoutMode === "embedded" && !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
		throw new Error(
			"Embedded checkout requires NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
		);
	}
	const redirectParams = buildCheckoutRedirectParams(
		checkoutMode,
		successUrl,
		cancelUrl,
	);

	const sessionParams: Stripe.Checkout.SessionCreateParams = {
		mode,
		line_items: lineItems,
		...redirectParams,
		branding_settings: buildCheckoutBrandingSettings(colorScheme),
		metadata: buildCheckoutMetadata({
			organizationId,
			planId: plan.id,
			priceId: price.id,
			metadata,
		}),
		// Allow promo codes
		allow_promotion_codes: true,
		// Collect billing address for tax
		billing_address_collection: "auto",
		// Enable automatic tax calculation if configured
		// automatic_tax: { enabled: true },
	};

	// Handle existing customer or create new one
	if (stripeCustomerId) {
		sessionParams.customer = stripeCustomerId;
	} else if (email) {
		sessionParams.customer_email = email;
	}

	// Add subscription-specific settings
	if (isSubscription) {
		// Get trial days from price config or params
		const effectiveTrialDays =
			trialDays ?? ("trialDays" in price ? price.trialDays : undefined);

		if (effectiveTrialDays && effectiveTrialDays > 0) {
			sessionParams.subscription_data = {
				trial_period_days: effectiveTrialDays,
				metadata: {
					organizationId,
					planId: plan.id,
				},
			};
		} else {
			sessionParams.subscription_data = {
				metadata: {
					organizationId,
					planId: plan.id,
				},
			};
		}
	} else {
		// One-time payment settings
		sessionParams.payment_intent_data = {
			metadata: {
				organizationId,
				planId: plan.id,
			},
		};
	}

	// Generate idempotency key to prevent duplicate checkout sessions on retry
	// Uses organizationId + priceId + timestamp (rounded to minute) for uniqueness
	const idempotencyKey = buildCheckoutIdempotencyKey({
		organizationId,
		stripePriceId,
		quantity,
		checkoutMode,
		colorScheme,
	});

	const session = await stripe.checkout.sessions.create(sessionParams, {
		idempotencyKey,
	});

	return buildCheckoutResult(checkoutMode, session);
}

/**
 * Create a checkout session with automatic customer creation.
 * This is a convenience wrapper that handles customer lookup/creation.
 */
export async function createCheckoutWithCustomer(params: {
	organizationId: string;
	organizationName: string;
	stripePriceId: string;
	successUrl: string;
	cancelUrl: string;
	email?: string;
	quantity?: number;
	trialDays?: number;
	metadata?: Record<string, string>;
}): Promise<CheckoutResult> {
	const {
		organizationId,
		organizationName,
		stripePriceId,
		successUrl,
		cancelUrl,
		email,
		quantity,
		trialDays,
		metadata,
	} = params;

	// Get or create the Stripe customer
	const customer = await getOrCreateStripeCustomer({
		organizationId,
		organizationName,
		email,
	});

	return createCheckoutSession({
		organizationId,
		stripePriceId,
		successUrl,
		cancelUrl,
		stripeCustomerId: customer.id,
		quantity,
		trialDays,
		metadata,
	});
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(
	sessionId: string,
): Promise<Stripe.Checkout.Session> {
	const stripe = getStripe();
	return stripe.checkout.sessions.retrieve(sessionId, {
		expand: ["subscription", "payment_intent", "customer"],
	});
}
