"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import {
	EmbeddedCheckout,
	EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export type StripeCheckoutModalProps = NiceModalHocProps & {
	clientSecret: string;
};

export const StripeCheckoutModal = NiceModal.create<StripeCheckoutModalProps>(
	({ clientSecret }) => {
		const modal = useEnhancedModal();

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[34rem] gap-0 overflow-hidden p-0 sm:max-w-[34rem]">
					<DialogHeader className="border-b px-5 py-4 pr-12 text-left">
						<DialogTitle>Secure checkout</DialogTitle>
						<DialogDescription>
							Complete your purchase securely with Stripe.
						</DialogDescription>
					</DialogHeader>

					{stripePromise ? (
						<div className="min-h-0 overflow-y-auto overscroll-contain bg-background px-1 py-3 sm:px-2">
							<EmbeddedCheckoutProvider
								stripe={stripePromise}
								options={{ clientSecret }}
							>
								<EmbeddedCheckout />
							</EmbeddedCheckoutProvider>
						</div>
					) : (
						<Alert variant="destructive" className="m-5 w-auto">
							<AlertTitle>Checkout is not configured</AlertTitle>
							<AlertDescription>
								Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or switch
								STRIPE_CHECKOUT_MODE to hosted.
							</AlertDescription>
						</Alert>
					)}
				</DialogContent>
			</Dialog>
		);
	},
);
