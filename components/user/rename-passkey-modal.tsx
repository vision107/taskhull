"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useQueryClient } from "@tanstack/react-query";
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
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { passkeysQueryKey } from "@/hooks/use-passkeys";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";

const renamePasskeySchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(100, "Name is too long"),
});

export type RenamePasskeyModalProps = NiceModalHocProps & {
	passkeyId: string;
	currentName?: string | null;
};

export const RenamePasskeyModal = NiceModal.create<RenamePasskeyModalProps>(
	({ passkeyId, currentName }) => {
		const modal = useEnhancedModal();
		const queryClient = useQueryClient();
		const initialName = currentName ?? "";
		const form = useZodForm({
			schema: renamePasskeySchema,
			defaultValues: { name: initialName },
		});

		const onSubmit = form.handleSubmit(async ({ name }) => {
			const normalizedName = name.trim();

			if (normalizedName === initialName.trim()) {
				modal.handleClose();
				return;
			}

			const { error } = await authClient.passkey.updatePasskey({
				id: passkeyId,
				name: normalizedName,
			});

			if (error) {
				toast.error("Could not rename passkey");
				return;
			}

			await queryClient.invalidateQueries({ queryKey: passkeysQueryKey });
			toast.success("Passkey renamed");
			modal.handleClose();
		});

		return (
			<Form {...form}>
				<Dialog
					open={modal.visible}
					onOpenChange={modal.handleOpenChange}
					onOpenChangeComplete={modal.handleOpenChangeComplete}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Name passkey</DialogTitle>
							<DialogDescription>
								Choose a recognizable name so you can identify this passkey
								later.
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={onSubmit}>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Passkey name</FormLabel>
										<FormControl>
											<Input {...field} placeholder="MacBook Touch ID" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<DialogFooter className="mt-4">
								<Button
									disabled={form.formState.isSubmitting}
									onClick={modal.handleClose}
									type="button"
									variant="outline"
								>
									Cancel
								</Button>
								<Button loading={form.formState.isSubmitting} type="submit">
									Save
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</Form>
		);
	},
);
