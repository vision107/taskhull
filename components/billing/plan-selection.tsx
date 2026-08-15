"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PricingTable } from "@/components/billing/pricing-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { appConfig } from "@/config/app.config";
import {
	calculateYearlySavingsPercent,
	getPlansForPricingTable,
} from "@/lib/billing/utils";
import { trpc } from "@/trpc/client";

interface PlanSelectionProps {
	className?: string;
	canManageBilling: boolean;
}

/**
 * Plan selection component for the choose-plan page.
 * Displays available plans and handles checkout flow.
 */
export function PlanSelection({
	className,
	canManageBilling,
}: PlanSelectionProps) {
	const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

	// Memoize static config-based computations
	const plans = useMemo(() => getPlansForPricingTable(), []);
	const yearlySavingsPercent = useMemo(
		() => calculateYearlySavingsPercent(),
		[],
	);

	const createCheckout =
		trpc.organization.subscription.createCheckout.useMutation({
			onSuccess: (data) => {
				if (data.url) {
					window.location.href = data.url;
				} else {
					// No URL returned - something went wrong
					console.error("Checkout session created but no URL returned");
					toast.error("Failed to create checkout session. Please try again.");
					setLoadingPriceId(null);
				}
			},
			onError: (error) => {
				toast.error(error.message || "Failed to create checkout session");
				setLoadingPriceId(null);
			},
		});

	const handleSelectPlan = (stripePriceId: string) => {
		if (!canManageBilling) {
			return;
		}

		// Prevent double-clicks
		if (createCheckout.isPending || loadingPriceId) {
			return;
		}

		setLoadingPriceId(stripePriceId);
		createCheckout.mutate({
			priceId: stripePriceId,
			successUrl: `${appConfig.baseUrl}/dashboard/billing/return?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${appConfig.baseUrl}/dashboard/choose-plan?checkout=cancelled`,
		});
	};

	return (
		<div className={className}>
			{!canManageBilling && (
				<Alert className="mx-auto mb-6 max-w-2xl">
					<AlertTitle>Billing access required</AlertTitle>
					<AlertDescription>
						Ask an organization owner or admin to choose a plan for this
						organization.
					</AlertDescription>
				</Alert>
			)}
			<PricingTable
				plans={plans}
				onSelectPlan={canManageBilling ? handleSelectPlan : undefined}
				loadingPriceId={loadingPriceId}
				showFreePlans={false}
				showEnterprisePlans={true}
				yearlySavingsPercent={yearlySavingsPercent}
				enterpriseContactEmail={appConfig.contact.email}
			/>
		</div>
	);
}
