"use client";

import NiceModal from "@ebay/nice-modal-react";

type CheckoutPresentation =
	| { mode: "embedded"; clientSecret: string }
	| { mode: "hosted"; url: string };

export async function presentCheckout(
	checkout: CheckoutPresentation,
): Promise<void> {
	if (checkout.mode === "hosted") {
		window.location.assign(checkout.url);
		return;
	}

	const { StripeCheckoutModal } =
		await import("@/components/billing/stripe-checkout-modal");

	await NiceModal.show(StripeCheckoutModal, {
		clientSecret: checkout.clientSecret,
	});
}
