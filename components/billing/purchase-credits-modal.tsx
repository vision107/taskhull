"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { presentCheckout } from "@/components/billing/present-checkout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { formatCurrency } from "@/lib/billing/utils";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type PurchaseCreditsModalProps = NiceModalHocProps;

export const PurchaseCreditsModal = NiceModal.create<PurchaseCreditsModalProps>(
	() => {
		const modal = useEnhancedModal();
		const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

		const {
			data: packages,
			isLoading: packagesLoading,
			isError: packagesError,
		} = trpc.organization.credit.getPackages.useQuery();

		const purchaseMutation =
			trpc.organization.credit.purchaseCredits.useMutation({
				onSuccess: (data) => {
					setSelectedPackage(null);
					modal.dismissForNavigation();
					void presentCheckout(data);
				},
				onError: (error) => {
					toast.error(error.message);
					setSelectedPackage(null);
				},
			});

		const handlePurchase = (packageId: string) => {
			setSelectedPackage(packageId);
			purchaseMutation.mutate({ packageId });
		};

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Buy Credits</DialogTitle>
						<DialogDescription>
							Choose a credit package that fits your needs
						</DialogDescription>
					</DialogHeader>

					{packagesError ? (
						<Alert variant="destructive">
							<AlertCircleIcon className="h-4 w-4" />
							<AlertTitle>Failed to load packages</AlertTitle>
							<AlertDescription>
								Unable to fetch credit packages. Please try again.
							</AlertDescription>
						</Alert>
					) : packagesLoading ? (
						<div className="space-y-4 py-4">
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : packages && packages.length > 0 ? (
						<div className="grid gap-4 py-4">
							{packages.map((pkg) => (
								<div
									key={pkg.id}
									className={cn(
										"relative rounded-lg border bg-neutral-50 p-4 transition-colors dark:bg-neutral-950",

										purchaseMutation.isPending &&
											selectedPackage === pkg.id &&
											"opacity-70",
									)}
								>
									{pkg.popular && (
										<span className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full bg-linear-to-br from-purple-400 to-amber-300 px-3 py-1 text-xs font-medium text-amber-950 ring-1 ring-white/20 ring-offset-1 ring-offset-gray-950/5 ring-inset">
											Popular
										</span>
									)}
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-sm font-medium">{pkg.name}</h3>
											<p className="text-xs text-muted-foreground">
												{pkg.description}
											</p>
											<div className="mt-1.5">
												<span className="text-lg font-semibold">
													{pkg.totalCredits.toLocaleString()}
												</span>
												<span className="text-sm text-muted-foreground">
													{" "}
													credits
												</span>
												{pkg.bonusCredits > 0 && (
													<span className="ml-2 text-xs text-green-600">
														(+{pkg.bonusCredits.toLocaleString()} bonus)
													</span>
												)}
											</div>
										</div>
										<div className="text-right">
											<div className="text-lg font-semibold">
												{formatCurrency(pkg.priceAmount, pkg.currency)}
											</div>
											<Button
												size="sm"
												className="mt-1.5"
												disabled={purchaseMutation.isPending}
												onClick={() => handlePurchase(pkg.id)}
											>
												{purchaseMutation.isPending &&
												selectedPackage === pkg.id
													? "Processing..."
													: "Buy Now"}
											</Button>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="py-8 text-center text-sm text-muted-foreground">
							No credit packages available
						</p>
					)}
				</DialogContent>
			</Dialog>
		);
	},
);
