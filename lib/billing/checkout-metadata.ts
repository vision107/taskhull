import type Stripe from "stripe";

type CheckoutMetadataParams = {
	organizationId: string;
	planId: string;
	priceId: string;
	metadata?: Stripe.MetadataParam;
};

/**
 * Keep webhook routing fields authoritative even when callers add metadata.
 */
export function buildCheckoutMetadata({
	organizationId,
	planId,
	priceId,
	metadata = {},
}: CheckoutMetadataParams): Stripe.MetadataParam {
	return {
		...metadata,
		organizationId,
		planId,
		priceId,
	};
}
