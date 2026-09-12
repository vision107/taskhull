"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/custom/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
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
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { toDateString } from "@/lib/manufacturing/scheduling";
import { createBuildSchema } from "@/schemas/manufacturing-schemas";
import { trpc } from "@/trpc/client";

export type BuildModalProps = NiceModalHocProps & {
	/** Preselect a product (e.g. when opened from the product page). */
	productId?: string;
};

export const BuildModal = NiceModal.create<BuildModalProps>(
	({ productId: initialProductId }) => {
		const modal = useEnhancedModal();
		const router = useRouter();
		const utils = trpc.useUtils();

		const { data: products } = trpc.organization.product.list.useQuery({
			includeArchived: false,
		});

		const form = useZodForm({
			schema: createBuildSchema,
			defaultValues: {
				productId: initialProductId ?? "",
				templateVersionId: undefined,
				serialNumber: "",
				name: "",
				description: "",
				plannedStartDate: toDateString(new Date()),
			},
		});

		const productId = form.watch("productId");
		const { data: product } = trpc.organization.product.get.useQuery(
			{ id: productId },
			{ enabled: Boolean(productId) },
		);
		const publishedVersions = React.useMemo(
			() =>
				(product?.template?.versions ?? []).filter(
					(version) => version.status === "published",
				),
			[product],
		);
		const latestPublished = publishedVersions[0];

		// Default the version to the latest published one whenever the product changes.
		React.useEffect(() => {
			form.setValue("templateVersionId", latestPublished?.id);
		}, [latestPublished?.id, form]);

		const createMutation = trpc.organization.build.create.useMutation({
			onSuccess: (created) => {
				toast.success(`Build ${created.serialNumber} created`);
				void utils.organization.build.list.invalidate();
				void utils.organization.build.assignmentGrid.invalidate();
				void utils.organization.product.get.invalidate({
					id: created.productId,
				});
				void utils.organization.product.list.invalidate();
				modal.dismissForNavigation();
				router.push(`/dashboard/organization/builds/${created.id}`);
			},
			onError: (error) => toast.error(error.message),
		});

		const onSubmit = form.handleSubmit((data) => {
			createMutation.mutate({
				...data,
				name: data.name || undefined,
				description: data.description || undefined,
			} as Parameters<typeof createMutation.mutate>[0]);
		});

		const productItems = (products ?? []).map((item) => ({
			label: item.name,
			value: item.id,
		}));
		const versionItems = publishedVersions.map((version) => ({
			label: `v${version.versionNumber}${
				version.id === latestPublished?.id ? " (latest)" : ""
			}${version.changeNote ? ` – ${version.changeNote}` : ""}`,
			value: version.id,
		}));
		const hasTemplate = Boolean(product?.template);
		const canCreate =
			Boolean(productId) && (!hasTemplate || publishedVersions.length > 0);

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>New build</DialogTitle>
						<DialogDescription>
							One build is one unit. Its tasks are copied from the chosen
							template version and scheduled from the start date.
						</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={onSubmit} className="space-y-4">
							<FormField
								control={form.control}
								name="productId"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Product</FormLabel>
											<Select
												items={productItems}
												value={field.value || null}
												onValueChange={(value) => field.onChange(value ?? "")}
												disabled={Boolean(initialProductId)}
											>
												<FormControl>
													<SelectTrigger className="w-full">
														<SelectValue placeholder="Select product" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{productItems.map((item) => (
														<SelectItem key={item.value} value={item.value}>
															{item.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>

							{productId && hasTemplate && (
								<FormField
									control={form.control}
									name="templateVersionId"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Template version</FormLabel>
												{publishedVersions.length === 0 ? (
													<p className="text-sm text-destructive">
														{product?.template?.name} has no published version
														yet. Publish one first.
													</p>
												) : (
													<Select
														items={versionItems}
														value={field.value ?? null}
														onValueChange={(value) =>
															field.onChange(value ?? undefined)
														}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder="Select version" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{versionItems.map((item) => (
																<SelectItem key={item.value} value={item.value}>
																	{item.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												)}
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							)}
							{productId && product && !hasTemplate && (
								<p className="text-sm text-muted-foreground">
									This product has no template. The build starts without tasks;
									you can add them manually.
								</p>
							)}

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="serialNumber"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Serial number</FormLabel>
												<FormControl>
													<Input
														placeholder="CX-2026-041"
														autoComplete="off"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="plannedStartDate"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Start date</FormLabel>
												<FormControl>
													<DatePicker
														className="w-full"
														date={
															field.value ? parseISO(field.value) : undefined
														}
														onDateChange={(date) =>
															field.onChange(
																date ? format(date, "yyyy-MM-dd") : "",
															)
														}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Label (optional)</FormLabel>
											<FormControl>
												<Input
													placeholder="Customer or order reference"
													autoComplete="off"
													{...field}
													value={field.value ?? ""}
												/>
											</FormControl>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={modal.handleClose}
									disabled={createMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={!canCreate || createMutation.isPending}
									loading={createMutation.isPending}
								>
									Create build
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		);
	},
);
