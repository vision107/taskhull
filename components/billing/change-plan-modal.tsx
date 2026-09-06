"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { format } from "date-fns";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { formatCurrency } from "@/lib/billing/utils";
import { trpc } from "@/trpc/client";

export type ChangePlanModalProps = NiceModalHocProps & {
	newPriceId: string;
};

export const ChangePlanModal = NiceModal.create<ChangePlanModalProps>(
	({ newPriceId }) => {
		const utils = trpc.useUtils();
		const mutationPendingRef = useRef(false);
		const modal = useEnhancedModal({
			blockHistoryDismiss: () => mutationPendingRef.current,
		});
		const preview = trpc.organization.subscription.previewPlanChange.useQuery(
			{ newPriceId },
			{ enabled: modal.visible, retry: false },
		);
		const changePlan = trpc.organization.subscription.changePlan.useMutation({
			onMutate: () => {
				mutationPendingRef.current = true;
			},
			onSuccess: async (result) => {
				await Promise.all([
					utils.organization.subscription.getStatus.invalidate(),
					utils.organization.subscription.listPlans.invalidate(),
					utils.organization.get.invalidate(),
					utils.organization.list.invalidate(),
				]);
				toast.success(`Plan changed to ${result.newPlanName}`);
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message),
			onSettled: () => {
				mutationPendingRef.current = false;
			},
		});

		const data = preview.data;

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => {
					if (!open && changePlan.isPending) return;
					modal.handleOpenChange(open);
				}}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent aria-busy={preview.isLoading || changePlan.isPending}>
					<DialogHeader>
						<DialogTitle>Review plan change</DialogTitle>
						<DialogDescription>
							Stripe calculates the exact prorated charge or credit before you
							confirm.
						</DialogDescription>
					</DialogHeader>

					{preview.isLoading ? (
						<div
							className="space-y-3"
							aria-label="Loading plan change preview"
							aria-live="polite"
						>
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : preview.isError ? (
						<Alert variant="destructive">
							<AlertTitle>Unable to preview this change</AlertTitle>
							<AlertDescription>{preview.error.message}</AlertDescription>
						</Alert>
					) : data ? (
						<div className="space-y-4">
							<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border p-4">
								<PlanValue
									label="Current"
									name={data.currentPlan.name}
									amount={data.currentPlan.amount}
									currency={data.currentPlan.currency}
								/>
								{data.isUpgrade ? (
									<ArrowUpIcon className="size-4 text-primary" />
								) : (
									<ArrowDownIcon className="size-4 text-muted-foreground" />
								)}
								<PlanValue
									label="New"
									name={data.newPlan.name}
									amount={data.newPlan.amount}
									currency={data.newPlan.currency}
									align="right"
								/>
							</div>

							<div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
								<SummaryRow
									label="Due now"
									value={formatCurrency(data.immediateCharge, data.currency)}
								/>
								{data.credit > 0 ? (
									<SummaryRow
										label="Prorated credit"
										value={formatCurrency(data.credit, data.currency)}
									/>
								) : null}
								{data.nextBillingDate ? (
									<SummaryRow
										label="Next billing date"
										value={format(new Date(data.nextBillingDate), "PPP")}
									/>
								) : null}
							</div>
						</div>
					) : null}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={changePlan.isPending}
							onClick={modal.handleClose}
						>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={!data || preview.isError || changePlan.isPending}
							loading={changePlan.isPending}
							onClick={() => changePlan.mutate({ newPriceId })}
						>
							{data?.isUpgrade ? "Confirm upgrade" : "Confirm change"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);

function PlanValue({
	label,
	name,
	amount,
	currency,
	align = "left",
}: {
	label: string;
	name: string;
	amount: number;
	currency: string;
	align?: "left" | "right";
}) {
	return (
		<div className={align === "right" ? "text-right" : undefined}>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="font-medium">{name}</p>
			<p className="text-sm text-muted-foreground">
				{formatCurrency(amount, currency)}
			</p>
		</div>
	);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}
