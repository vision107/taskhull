"use client";

import { useTheme } from "next-themes";
import { useMemo } from "react";
import { toast } from "sonner";

import { PlanPicker } from "@/components/billing/plan-picker";
import { presentCheckout } from "@/components/billing/present-checkout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { appConfig } from "@/config/app.config";
import { getPlansForPricingTable } from "@/lib/billing/utils";
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
	const { resolvedTheme } = useTheme();
	// Memoize static config-based computations
	const plans = useMemo(() => getPlansForPricingTable(), []);
	const createCheckout =
		trpc.organization.subscription.createCheckout.useMutation({
			onSuccess: (data) => {
				void presentCheckout(data);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to create checkout session");
			},
		});

	const handleSelectPlan = (stripePriceId: string) => {
		if (!canManageBilling) {
			return;
		}

		// Prevent double-clicks
		if (createCheckout.isPending) {
			return;
		}

		createCheckout.mutate({
			priceId: stripePriceId,
			colorScheme: resolvedTheme === "dark" ? "dark" : "light",
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
			<PlanPicker
				plans={plans}
				disabled={!canManageBilling}
				pending={createCheckout.isPending}
				onSubmit={handleSelectPlan}
			/>
		</div>
	);
}
