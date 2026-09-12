"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import {
	createProductSchema,
	updateProductSchema,
} from "@/schemas/manufacturing-schemas";
import { trpc } from "@/trpc/client";

const NO_TEMPLATE = "__none__";

export type ProductModalProps = NiceModalHocProps & {
	product?: {
		id: string;
		name: string;
		description: string | null;
		templateId: string | null;
	};
};

export const ProductModal = NiceModal.create<ProductModalProps>(
	({ product }) => {
		const modal = useEnhancedModal();
		const router = useRouter();
		const utils = trpc.useUtils();
		const isEditing = !!product;

		const { data: templates } = trpc.organization.template.list.useQuery({
			includeArchived: false,
		});

		const createMutation = trpc.organization.product.create.useMutation({
			onSuccess: (created) => {
				toast.success("Product created");
				void utils.organization.product.list.invalidate();
				modal.dismissForNavigation();
				router.push(`/dashboard/organization/products/${created.id}`);
			},
			onError: (error) => toast.error(error.message),
		});

		const updateMutation = trpc.organization.product.update.useMutation({
			onSuccess: () => {
				toast.success("Product updated");
				void utils.organization.product.list.invalidate();
				if (product) {
					void utils.organization.product.get.invalidate({ id: product.id });
				}
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message),
		});

		const form = useZodForm({
			schema: isEditing ? updateProductSchema : createProductSchema,
			defaultValues: isEditing
				? {
						id: product.id,
						name: product.name,
						description: product.description ?? "",
						templateId: product.templateId,
					}
				: { name: "", description: "", templateId: null },
		});

		const onSubmit = form.handleSubmit((data) => {
			if (isEditing) {
				updateMutation.mutate(
					data as Parameters<typeof updateMutation.mutate>[0],
				);
			} else {
				createMutation.mutate(
					data as Parameters<typeof createMutation.mutate>[0],
				);
			}
		});

		const isPending = createMutation.isPending || updateMutation.isPending;
		const templateItems = [
			{ label: "No template", value: NO_TEMPLATE },
			...(templates ?? []).map((template) => ({
				label: template.latestPublishedVersion
					? `${template.name} (v${template.latestPublishedVersion.versionNumber})`
					: `${template.name} (not published yet)`,
				value: template.id,
			})),
		];

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{isEditing ? "Edit product" : "New product"}
						</DialogTitle>
						<DialogDescription>
							A product is the thing you build repeatedly. Each unit becomes a
							build; its tasks come from the linked template.
						</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={onSubmit} className="space-y-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Conveyor CX-200"
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
							<FormField
								control={form.control}
								name="templateId"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Template</FormLabel>
											<Select
												items={templateItems}
												value={field.value ?? NO_TEMPLATE}
												onValueChange={(value) =>
													field.onChange(value === NO_TEMPLATE ? null : value)
												}
											>
												<FormControl>
													<SelectTrigger className="w-full">
														<SelectValue placeholder="Select template" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{templateItems.map((item) => (
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
							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Optional notes about this product"
													className="resize-none"
													rows={3}
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
									disabled={isPending}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isPending} loading={isPending}>
									{isEditing ? "Save" : "Create"}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		);
	},
);
