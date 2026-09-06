"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format } from "date-fns";
import {
	AlertCircle,
	Check,
	ExternalLink,
	FileText,
	RefreshCw,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { ChangePlanModal } from "@/components/billing/change-plan-modal";
import { PlanPicker } from "@/components/billing/plan-picker";
import { presentCheckout } from "@/components/billing/present-checkout";
import { SubscriptionStatusBadge } from "@/components/billing/subscription-status-badge";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMonthlyEquivalent } from "@/lib/billing/plan-presentation";
import { formatCurrency } from "@/lib/billing/utils";
import { trpc } from "@/trpc/client";

interface SubscriptionSettingsTabProps {
	/** Whether the current user is an admin/owner of the organization */
	isAdmin: boolean;
}

const RECURRING_PAYMENT_TYPES = ["recurring"] as const;

export function SubscriptionSettingsTab({
	isAdmin,
}: SubscriptionSettingsTabProps) {
	const { resolvedTheme } = useTheme();
	const searchParams = useSearchParams();
	const hasShownFeedback = useRef(false);

	const utils = trpc.useUtils();
	const invalidateSubscriptionQueries = useCallback(
		() =>
			Promise.all([
				utils.organization.subscription.getStatus.invalidate(),
				utils.organization.subscription.listInvoices.invalidate(),
				utils.organization.get.invalidate(),
				utils.organization.list.invalidate(),
				utils.admin.organization.list.invalidate(),
				utils.organization.credit.getBalance.invalidate(),
				utils.organization.credit.getTransactions.invalidate(),
			]),
		[utils],
	);

	// Handle checkout success/cancel URL params and show feedback
	useEffect(() => {
		if (hasShownFeedback.current) return;

		const success = searchParams.get("success");
		const canceled = searchParams.get("canceled");

		if (success === "true") {
			hasShownFeedback.current = true;
			toast.success("Subscription activated successfully!", {
				description: "Your billing has been updated.",
			});

			// Refresh billing data
			void invalidateSubscriptionQueries();

			// Clean up URL
			const url = new URL(window.location.href);
			url.searchParams.delete("success");
			window.history.replaceState({}, "", url.toString());
		}

		if (canceled === "true") {
			hasShownFeedback.current = true;
			toast.info("Checkout was canceled", {
				description: "No changes were made to your subscription.",
			});

			// Clean up URL
			const url = new URL(window.location.href);
			url.searchParams.delete("canceled");
			window.history.replaceState({}, "", url.toString());
		}
	}, [invalidateSubscriptionQueries, searchParams]);

	const {
		data: billingStatus,
		isLoading: statusLoading,
		isError: statusError,
	} = trpc.organization.subscription.getStatus.useQuery();
	const { data: invoices, isLoading: invoicesLoading } =
		trpc.organization.subscription.listInvoices.useQuery({ limit: 5 });

	const createPortalSession =
		trpc.organization.subscription.createPortalSession.useMutation({
			onSuccess: (data) => {
				window.location.href = data.url;
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});

	const cancelSubscription =
		trpc.organization.subscription.cancelSubscription.useMutation({
			onSuccess: async () => {
				toast.success(
					"Subscription will be canceled at the end of the billing period",
				);
				await invalidateSubscriptionQueries();
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});

	const reactivateSubscription =
		trpc.organization.subscription.reactivateSubscription.useMutation({
			onSuccess: async () => {
				toast.success("Subscription reactivated");
				await invalidateSubscriptionQueries();
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});

	const {
		data: plansData,
		isLoading: plansLoading,
		isError: plansError,
	} = trpc.organization.subscription.listPlans.useQuery();

	const createCheckout =
		trpc.organization.subscription.createCheckout.useMutation({
			onSuccess: (data) => {
				void presentCheckout(data);
			},
			onError: (error) => {
				toast.error(error.message);
			},
		});

	const handleSelectPlan = (priceId: string) => {
		if (!isAdmin) return;

		if (billingStatus?.activePlan?.planId === "free") {
			createCheckout.mutate({
				priceId,
				colorScheme: resolvedTheme === "dark" ? "dark" : "light",
			});
			return;
		}

		void NiceModal.show(ChangePlanModal, { newPriceId: priceId });
	};

	if (statusLoading || plansLoading) {
		return <SubscriptionSettingsTabSkeleton />;
	}

	if (statusError || plansError) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Failed to load billing information</AlertTitle>
				<AlertDescription>
					Please try refreshing the page. If the problem persists, contact
					support.
				</AlertDescription>
			</Alert>
		);
	}

	if (!billingStatus?.enabled) {
		const isNotConfigured = billingStatus?.disabledReason === "not_configured";

		return (
			<Alert variant={isNotConfigured ? "destructive" : "default"}>
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>
					{isNotConfigured ? "Stripe Not Configured" : "Billing Not Enabled"}
				</AlertTitle>
				<AlertDescription>
					{isNotConfigured
						? "Stripe API keys are not configured. Please add STRIPE_SECRET_KEY to your environment variables."
						: "Billing is not enabled for this application. Contact support for more information."}
				</AlertDescription>
			</Alert>
		);
	}

	const { activePlan, subscription } = billingStatus;
	const plans = plansData?.plans ?? [];

	const isFreePlan = activePlan?.planId === "free";
	const activePriceId =
		activePlan && "stripePriceId" in activePlan
			? activePlan.stripePriceId
			: null;
	const activePrice = plans
		.flatMap((plan) => plan.prices)
		.find((price) => price.stripePriceId === activePriceId);
	const activeMonthlyEquivalent = activePrice
		? getMonthlyEquivalent(activePrice)
		: null;
	const isCanceling = subscription?.cancelAtPeriodEnd;

	return (
		<div className="space-y-6">
			{/* Current Plan Card */}
			<Card className="overflow-hidden">
				<CardHeader className="border-b">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<CardTitle>Current Plan</CardTitle>
							<CardDescription>
								{isAdmin
									? "Your current subscription and billing information"
									: "Only organization owners and admins can manage billing"}
							</CardDescription>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{subscription ? (
								<SubscriptionStatusBadge status={subscription.status} />
							) : (
								<Badge variant="secondary">Active</Badge>
							)}
							{!isFreePlan && !activePlan?.isLifetime && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => createPortalSession.mutate({})}
									loading={createPortalSession.isPending}
									disabled={!isAdmin}
								>
									Manage Billing
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6 pt-6">
					{/* Plan Info */}
					<div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<h3 className="text-2xl font-semibold tracking-tight">
									{activePlan?.planName}
								</h3>
								{activePlan?.isLifetime && (
									<Badge variant="outline">Lifetime</Badge>
								)}
							</div>
							{isFreePlan && (
								<p className="text-sm text-muted-foreground">
									Upgrade to unlock more features
								</p>
							)}
							{activePlan?.isTrialing && subscription?.trialEnd && (
								<p className="text-sm text-muted-foreground">
									Trial ends {format(new Date(subscription.trialEnd), "PPP")}
								</p>
							)}
							{!isFreePlan &&
								!activePlan?.isLifetime &&
								subscription?.currentPeriodEnd && (
									<p className="text-sm text-muted-foreground">
										{isCanceling ? "Access until" : "Renews"}{" "}
										{format(new Date(subscription.currentPeriodEnd), "PPP")}
									</p>
								)}
						</div>

						{(isFreePlan || activePrice) && (
							<div className="shrink-0 sm:text-right">
								<p className="text-2xl font-semibold tracking-tight">
									{formatCurrency(
										activePrice
											? (activeMonthlyEquivalent ?? activePrice.amount)
											: 0,
										activePrice?.currency ?? "usd",
									)}
									<span className="ml-1 text-sm font-normal text-muted-foreground">
										{activePrice?.type === "one_time"
											? "once"
											: activePrice?.seatBased
												? "/member/month"
												: "/month"}
									</span>
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{isFreePlan
										? "No payment method required"
										: activePrice?.type === "one_time"
											? "Paid once"
											: activePrice?.interval === "year"
												? `${formatCurrency(activePrice.amount, activePrice.currency)} billed yearly`
												: "Billed monthly"}
								</p>
							</div>
						)}
					</div>

					{/* Cancellation Warning */}
					{isCanceling && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription className="flex items-center justify-between">
								<span>
									Your subscription is set to cancel on{" "}
									{subscription?.currentPeriodEnd &&
										format(new Date(subscription.currentPeriodEnd), "PPP")}
									.
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => reactivateSubscription.mutate()}
									loading={reactivateSubscription.isPending}
									disabled={!isAdmin}
								>
									<RefreshCw className="mr-1 h-4 w-4" />
									Reactivate
								</Button>
							</AlertDescription>
						</Alert>
					)}

					{/* Features */}
					{activePlan?.features && activePlan.features.length > 0 && (
						<div className="border-t border-dashed pt-5">
							<h4 className="mb-3 text-sm font-medium">Included features</h4>
							<ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
								{activePlan.features.map((feature) => (
									<li
										key={feature}
										className="flex items-center gap-2 text-sm text-muted-foreground"
									>
										<Check className="h-4 w-4 shrink-0 text-foreground" />
										{feature}
									</li>
								))}
							</ul>
						</div>
					)}
				</CardContent>
				{!isFreePlan && !activePlan?.isLifetime && !isCanceling && (
					<CardFooter className="border-t pt-6">
						<Button
							variant="destructive"
							size="sm"
							onClick={() => {
								void NiceModal.show(ConfirmationModal, {
									title: "Cancel Subscription",
									message:
										"Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.",
									confirmLabel: "Cancel Subscription",
									destructive: true,
									onConfirm: () => {
										cancelSubscription.mutate();
									},
								});
							}}
							loading={cancelSubscription.isPending}
							disabled={!isAdmin}
						>
							Cancel Subscription
						</Button>
					</CardFooter>
				)}
			</Card>

			{/* Plan selection and changes */}
			{!activePlan?.isLifetime && (
				<div className="space-y-4">
					<div>
						<h3 className="text-lg font-semibold">
							{isFreePlan ? "Upgrade your plan" : "Change plan"}
						</h3>
						<p className="text-sm text-muted-foreground">
							Compare billing intervals and review the exact price before
							continuing.
						</p>
					</div>

					{!isAdmin && (
						<Alert>
							<AlertTitle>Billing access required</AlertTitle>
							<AlertDescription>
								Only organization owners and admins can choose or change a plan.
							</AlertDescription>
						</Alert>
					)}

					<PlanPicker
						plans={plans}
						currentPriceId={activePriceId}
						canStartTrial={isFreePlan}
						allowedPaymentTypes={
							isFreePlan ? undefined : RECURRING_PAYMENT_TYPES
						}
						disabled={!isAdmin || Boolean(isCanceling)}
						pending={createCheckout.isPending}
						onSubmit={handleSelectPlan}
						submitLabel={
							isFreePlan ? "Continue to checkout" : "Review plan change"
						}
					/>
				</div>
			)}
			{/* Invoices */}
			{!isFreePlan && (
				<Card>
					<CardHeader>
						<CardTitle>Recent Invoices</CardTitle>
						<CardDescription>
							{isAdmin
								? "View and download your invoices"
								: "You can view invoices, but only owners and admins can open the billing portal"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{invoicesLoading ? (
							<div className="space-y-2">
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
							</div>
						) : invoices && invoices.length > 0 ? (
							<div className="space-y-2">
								{invoices.map((invoice: any) => (
									<div
										key={invoice.id}
										className="flex items-center justify-between rounded-lg border p-3"
									>
										<div className="flex items-center gap-3">
											<FileText className="h-4 w-4 text-muted-foreground" />
											<div>
												<p className="text-sm font-medium">
													{invoice.number ?? invoice.id}
												</p>
												<p className="text-xs text-muted-foreground">
													{format(new Date(invoice.createdAt), "PPP")}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-3">
											<span className="text-sm font-medium">
												{formatCurrency(invoice.amount, invoice.currency)}
											</span>
											{invoice.hostedInvoiceUrl && (
												<a
													href={invoice.hostedInvoiceUrl}
													target="_blank"
													rel="noopener noreferrer"
													aria-label={`View invoice ${invoice.number ?? invoice.id}`}
													className={buttonVariants({
														variant: "ghost",
														size: "sm",
													})}
												>
													<ExternalLink className="h-4 w-4" />
												</a>
											)}
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">No invoices yet</p>
						)}
					</CardContent>
					{billingStatus.hasStripeCustomer && (
						<CardFooter className="border-t pt-6">
							<Button
								variant="outline"
								onClick={() => createPortalSession.mutate({})}
								loading={createPortalSession.isPending}
								disabled={!isAdmin}
							>
								View All Invoices
							</Button>
						</CardFooter>
					)}
				</Card>
			)}
		</div>
	);
}

function SubscriptionSettingsTabSkeleton() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-4 w-48" />
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg border p-4">
						<div className="flex items-center justify-between">
							<div className="space-y-2">
								<Skeleton className="h-6 w-24" />
								<Skeleton className="h-4 w-36" />
							</div>
							<Skeleton className="h-9 w-28" />
						</div>
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-full" />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
