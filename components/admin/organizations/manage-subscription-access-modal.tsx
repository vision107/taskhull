"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { format } from "date-fns";
import { useRef } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { billingConfig } from "@/config/billing.config";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { trpc } from "@/trpc/client";

const grantAccessSchema = z.object({
	stripePriceId: z.string().startsWith("price_", "Select a subscription plan"),
	trialDays: z.number().int().min(1).max(365),
});

const extendAccessSchema = z.object({
	additionalDays: z.number().int().min(1).max(365),
});

const grantablePrices = Object.values(billingConfig.plans).flatMap((plan) =>
	"prices" in plan && plan.prices
		? plan.prices.flatMap((price) =>
				price.type === "recurring" && price.stripePriceId
					? [
							{
								stripePriceId: price.stripePriceId,
								label: `${plan.name} (${price.interval === "year" ? "yearly" : `${price.interval}ly`})`,
							},
						]
					: [],
			)
		: [],
);

const grantablePriceItems = Object.fromEntries(
	grantablePrices.map((price) => [price.stripePriceId, price.label]),
);

async function invalidateSubscriptionData(
	utils: ReturnType<typeof trpc.useUtils>,
): Promise<void> {
	await Promise.all([
		utils.admin.organization.list.invalidate(),
		utils.organization.subscription.getStatus.invalidate(),
		utils.organization.subscription.listInvoices.invalidate(),
		utils.organization.get.invalidate(),
	]);
}

export type GrantSubscriptionAccessModalProps = NiceModalHocProps & {
	organizationId: string;
	organizationName: string;
};

export const GrantSubscriptionAccessModal = NiceModal.create(
	({ organizationId, organizationName }: GrantSubscriptionAccessModalProps) => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const requestId = useRef<string | null>(null);
		const form = useZodForm({
			schema: grantAccessSchema,
			defaultValues: {
				stripePriceId: grantablePrices[0]?.stripePriceId ?? "",
				trialDays: 14,
			},
		});
		const mutation =
			trpc.admin.organization.grantSubscriptionAccess.useMutation({
				onSuccess: async (result) => {
					await invalidateSubscriptionData(utils);
					toast.success("Temporary subscription access granted", {
						description: result.trialEnd
							? `Access ends ${format(result.trialEnd, "PPP")}.`
							: undefined,
					});
					if (result.syncPending) {
						toast.warning(
							"Stripe was updated, but the local billing sync is still pending.",
						);
					}
					requestId.current = null;
					modal.handleClose();
				},
				onError: (error) => toast.error(error.message),
			});

		const onSubmit = form.handleSubmit((values) => {
			requestId.current ??= crypto.randomUUID();
			mutation.mutate({
				organizationId,
				requestId: requestId.current,
				...values,
			});
		});

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Grant temporary access</DialogTitle>
						<DialogDescription>
							Create a Stripe trial for <strong>{organizationName}</strong>. If
							no payment method is added, Stripe cancels it when the trial ends.
						</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form className="space-y-4" onSubmit={onSubmit}>
							<FormField
								control={form.control}
								name="stripePriceId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Plan</FormLabel>
										<Select
											items={grantablePriceItems}
											value={field.value}
											onValueChange={field.onChange}
										>
											<FormControl>
												<SelectTrigger className="w-full">
													<SelectValue placeholder="Select a plan" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{grantablePrices.map((price) => (
													<SelectItem
														key={price.stripePriceId}
														value={price.stripePriceId}
													>
														{price.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="trialDays"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Access duration</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												max={365}
												{...field}
												onChange={(event) =>
													field.onChange(Number(event.target.value))
												}
											/>
										</FormControl>
										<FormDescription>Between 1 and 365 days.</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									disabled={mutation.isPending}
									onClick={modal.handleClose}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									loading={mutation.isPending}
									disabled={grantablePrices.length === 0}
								>
									Grant access
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		);
	},
);

export type ExtendTrialAccessModalProps = NiceModalHocProps & {
	organizationId: string;
	organizationName: string;
	subscriptionId: string;
	currentTrialEnd: Date | null;
};

export const ExtendTrialAccessModal = NiceModal.create(
	({
		organizationId,
		organizationName,
		subscriptionId,
		currentTrialEnd,
	}: ExtendTrialAccessModalProps) => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const requestId = useRef<string | null>(null);
		const form = useZodForm({
			schema: extendAccessSchema,
			defaultValues: { additionalDays: 7 },
		});
		const mutation =
			trpc.admin.organization.extendSubscriptionAccess.useMutation({
				onSuccess: async (result) => {
					await invalidateSubscriptionData(utils);
					toast.success("Trial access extended", {
						description: result.trialEnd
							? `The trial now ends ${format(result.trialEnd, "PPP")}.`
							: undefined,
					});
					if (result.syncPending) {
						toast.warning(
							"Stripe was updated, but the local billing sync is still pending.",
						);
					}
					requestId.current = null;
					modal.handleClose();
				},
				onError: (error) => toast.error(error.message),
			});

		const onSubmit = form.handleSubmit((values) => {
			requestId.current ??= crypto.randomUUID();
			mutation.mutate({
				organizationId,
				subscriptionId,
				requestId: requestId.current,
				...values,
			});
		});

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Extend trial access</DialogTitle>
						<DialogDescription>
							Extend the Stripe trial for <strong>{organizationName}</strong>
							{currentTrialEnd
								? ` beyond ${format(currentTrialEnd, "PPP")}.`
								: "."}
						</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form className="space-y-4" onSubmit={onSubmit}>
							<FormField
								control={form.control}
								name="additionalDays"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Additional days</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												max={365}
												{...field}
												onChange={(event) =>
													field.onChange(Number(event.target.value))
												}
											/>
										</FormControl>
										<FormDescription>Between 1 and 365 days.</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									disabled={mutation.isPending}
									onClick={modal.handleClose}
								>
									Cancel
								</Button>
								<Button type="submit" loading={mutation.isPending}>
									Extend trial
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		);
	},
);
