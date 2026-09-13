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
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import {
	createTemplateSchema,
	updateTemplateSchema,
} from "@/schemas/manufacturing-schemas";
import { trpc } from "@/trpc/client";

export type TemplateModalProps = NiceModalHocProps & {
	template?: {
		id: string;
		name: string;
		description: string | null;
	};
};

export const TemplateModal = NiceModal.create<TemplateModalProps>(
	({ template }) => {
		const modal = useEnhancedModal();
		const router = useRouter();
		const utils = trpc.useUtils();
		const isEditing = !!template;

		const createMutation = trpc.organization.template.create.useMutation({
			onSuccess: (created) => {
				toast.success("Template created");
				void utils.organization.template.list.invalidate();
				modal.dismissForNavigation();
				router.push(`/dashboard/organization/templates/${created.id}`);
			},
			onError: (error) => toast.error(error.message),
		});

		const updateMutation = trpc.organization.template.update.useMutation({
			onSuccess: () => {
				toast.success("Template updated");
				void utils.organization.template.list.invalidate();
				if (template) {
					void utils.organization.template.get.invalidate({ id: template.id });
				}
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message),
		});

		const form = useZodForm({
			schema: isEditing ? updateTemplateSchema : createTemplateSchema,
			defaultValues: isEditing
				? {
						id: template.id,
						name: template.name,
						description: template.description ?? "",
					}
				: { name: "", description: "" },
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

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{isEditing ? "Edit template" : "New template"}
						</DialogTitle>
						<DialogDescription>
							{isEditing
								? "Rename or describe this template."
								: "A template is the reusable task plan for one unit. You add tasks in the next step."}
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
													placeholder="Machine XY"
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
								name="description"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													placeholder="What is built with this template?"
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
