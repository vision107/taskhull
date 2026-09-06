"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	getMonthlyEquivalent,
	getPlanPrice,
} from "@/lib/billing/plan-presentation";
import type { PlanDisplay, PriceDisplay } from "@/lib/billing/types";
import {
	calculateYearlySavingsPercent,
	formatCurrency,
} from "@/lib/billing/utils";
import { cn } from "@/lib/utils";

const ALL_PAYMENT_TYPES = ["recurring", "one_time"] as const;

interface PlanPickerProps {
	plans: PlanDisplay[];
	currentPriceId?: string | null;
	defaultInterval?: "month" | "year";
	allowedPaymentTypes?: readonly PriceDisplay["type"][];
	disabled?: boolean;
	pending?: boolean;
	canStartTrial?: boolean;
	onSubmit: (priceId: string) => void;
	submitLabel?: string;
}

export function PlanPicker({
	plans,
	currentPriceId,
	defaultInterval = "month",
	allowedPaymentTypes = ALL_PAYMENT_TYPES,
	disabled = false,
	pending = false,
	canStartTrial = true,
	onSubmit,
	submitLabel = "Continue to checkout",
}: PlanPickerProps) {
	const currentPrice = plans
		.flatMap((plan) => plan.prices)
		.find((price) => price.stripePriceId === currentPriceId);
	const initialInterval =
		currentPrice?.interval === "year" ? "year" : defaultInterval;
	const [interval, setInterval] = useState<"month" | "year">(initialInterval);
	const [submittedPriceId, setSubmittedPriceId] = useState<string | null>(null);
	const yearlySavingsPercent = calculateYearlySavingsPercent();

	const options = useMemo(
		() =>
			plans.flatMap((plan) => {
				if (plan.isFree || plan.isEnterprise) return [];

				const price = getPlanPrice(plan, interval);
				if (
					!price?.stripePriceId ||
					!allowedPaymentTypes.includes(price.type)
				) {
					return [];
				}

				return [{ plan, price }];
			}),
		[allowedPaymentTypes, interval, plans],
	);

	const hasMonthly = plans.some((plan) =>
		plan.prices.some(
			(price) => price.type === "recurring" && price.interval === "month",
		),
	);
	const hasYearly = plans.some((plan) =>
		plan.prices.some(
			(price) => price.type === "recurring" && price.interval === "year",
		),
	);

	const handleSubmit = (priceId: string) => {
		setSubmittedPriceId(priceId);
		onSubmit(priceId);
	};

	return (
		<div className="space-y-6" aria-busy={pending}>
			{hasMonthly && hasYearly && (
				<div className="flex justify-center">
					<div
						className="inline-flex rounded-full border bg-muted/60 p-1"
						aria-label="Billing interval"
					>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className={cn(
								"rounded-full px-4",
								interval === "month" &&
									"bg-background shadow-sm hover:bg-background",
							)}
							aria-pressed={interval === "month"}
							onClick={() => setInterval("month")}
						>
							Billed monthly
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className={cn(
								"rounded-full px-4",
								interval === "year" &&
									"bg-background shadow-sm hover:bg-background",
							)}
							aria-pressed={interval === "year"}
							onClick={() => setInterval("year")}
						>
							Billed yearly
							{yearlySavingsPercent > 0 && (
								<span className="text-xs text-primary">
									Save {yearlySavingsPercent}%
								</span>
							)}
						</Button>
					</div>
				</div>
			)}

			{options.length === 0 ? (
				<Alert variant="destructive">
					<AlertTitle>No purchasable plans configured</AlertTitle>
					<AlertDescription>
						Add Stripe price IDs to the billing environment variables.
					</AlertDescription>
				</Alert>
			) : (
				<div
					className={cn(
						"grid items-stretch gap-4",
						options.length > 1 && "md:grid-cols-2",
						options.length > 2 && "xl:grid-cols-3",
					)}
				>
					{options.map(({ plan, price }) => (
						<PlanOptionCard
							key={price.id}
							plan={plan}
							price={price}
							current={currentPriceId === price.stripePriceId}
							disabled={disabled || pending}
							loading={pending && submittedPriceId === price.stripePriceId}
							canStartTrial={canStartTrial}
							submitLabel={submitLabel}
							onSubmit={handleSubmit}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function PlanOptionCard({
	plan,
	price,
	current,
	disabled,
	loading,
	canStartTrial,
	submitLabel,
	onSubmit,
}: {
	plan: PlanDisplay;
	price: PriceDisplay;
	current: boolean;
	disabled: boolean;
	loading: boolean;
	canStartTrial: boolean;
	submitLabel: string;
	onSubmit: (priceId: string) => void;
}) {
	const monthlyEquivalent = getMonthlyEquivalent(price);
	const displayedAmount = monthlyEquivalent ?? price.amount;
	const buttonLabel = current
		? "Current plan"
		: canStartTrial && price.trialDays
			? `Start ${price.trialDays}-day trial`
			: submitLabel;

	return (
		<Card
			className={cn(
				"relative flex h-full flex-col overflow-visible py-0",
				plan.recommended && "border-foreground/30",
				current && "ring-1 ring-primary",
			)}
		>
			{plan.recommended && (
				<Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3">
					Popular
				</Badge>
			)}

			<CardHeader className="px-6 pt-7 pb-2">
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="text-xl">{plan.name}</CardTitle>
					{current && <Badge variant="outline">Current</Badge>}
				</div>
				<CardDescription className="text-sm">
					{plan.description}
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col px-6 pt-2 pb-6">
				<div>
					<div className="flex items-end gap-1">
						<span className="text-4xl font-semibold tracking-tight">
							{formatCurrency(displayedAmount, price.currency)}
						</span>
						<span className="pb-1 text-sm text-muted-foreground">
							{price.type === "one_time"
								? "once"
								: price.seatBased
									? "/member/month"
									: "/month"}
						</span>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						{price.type === "one_time"
							? "One-time payment"
							: price.interval === "year"
								? `${formatCurrency(price.amount, price.currency)} billed yearly`
								: "Billed monthly"}
					</p>
				</div>

				<Button
					type="button"
					className="mt-6 w-full"
					variant={plan.recommended ? "default" : "outline"}
					disabled={disabled || current}
					loading={loading}
					onClick={() => onSubmit(price.stripePriceId)}
				>
					{buttonLabel}
				</Button>

				<ul className="mt-6 flex flex-1 flex-col gap-2 border-t border-dashed pt-6">
					{plan.features.map((feature) => (
						<li
							key={feature}
							className="flex items-start gap-2 text-sm text-muted-foreground"
						>
							<CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
							<span>{feature}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
