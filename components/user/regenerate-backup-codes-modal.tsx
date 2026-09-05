"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod/v4";

import { BackupCodesPanel } from "@/components/auth/backup-codes-panel";
import { Button } from "@/components/ui/button";
import { InputPassword } from "@/components/ui/custom/input-password";
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
import { useBackupCodesGuard } from "@/hooks/use-backup-codes-guard";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";

const passwordSchema = z.object({
	password: z.string().min(1, "Enter your password."),
});

export type RegenerateBackupCodesModalProps = NiceModalHocProps;

export const RegenerateBackupCodesModal =
	NiceModal.create<RegenerateBackupCodesModalProps>(() => {
		const requestPendingRef = React.useRef(false);
		const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
		const [savedBackupCodes, setSavedBackupCodes] = React.useState(false);
		const modal = useEnhancedModal({
			blockHistoryDismiss: () =>
				requestPendingRef.current ||
				(backupCodes.length > 0 && !savedBackupCodes),
		});

		const form = useZodForm({
			schema: passwordSchema,
			defaultValues: { password: "" },
		});

		const mutation = useMutation({
			mutationKey: ["regenerateBackupCodes"],
			mutationFn: async (password: string) => {
				const { data, error } = await authClient.twoFactor.generateBackupCodes({
					password,
				});

				if (error) {
					throw error;
				}

				setBackupCodes(data.backupCodes);
				form.reset({ password: "" });
			},
			onError: () => {
				toast.error(
					"Could not verify your account with the provided password. Please try again.",
				);
			},
			onSettled: () => {
				requestPendingRef.current = false;
			},
		});

		const codesMustBeSaved = backupCodes.length > 0 && !savedBackupCodes;
		const dismissIsLocked = mutation.isPending || codesMustBeSaved;
		useBackupCodesGuard(dismissIsLocked);

		const handleOpenChange = (open: boolean): void => {
			if (!open && mutation.isPending) {
				return;
			}

			if (!open && codesMustBeSaved) {
				toast.warning("Save your new backup codes before closing this window.");
				return;
			}

			modal.handleOpenChange(open);
		};

		const onSubmit = form.handleSubmit(({ password }) => {
			if (requestPendingRef.current) {
				return;
			}

			requestPendingRef.current = true;
			mutation.mutate(password);
		});

		const handleDone = (): void => {
			if (!savedBackupCodes) {
				return;
			}

			modal.handleClose();
			toast.success("Backup codes regenerated successfully.");
		};

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="max-w-md" showCloseButton={!dismissIsLocked}>
					<DialogHeader>
						<DialogTitle>
							{backupCodes.length > 0
								? "Save your new backup codes"
								: "Regenerate backup codes"}
						</DialogTitle>
						<DialogDescription>
							{backupCodes.length > 0
								? "Your old backup codes no longer work. Save these new codes before you continue."
								: "Enter your password to generate new backup codes. Your existing backup codes will stop working."}
						</DialogDescription>
					</DialogHeader>
					{backupCodes.length === 0 ? (
						<Form {...form}>
							<form onSubmit={onSubmit}>
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Your password</FormLabel>
											<FormControl>
												<InputPassword
													autoComplete="current-password"
													disabled={mutation.isPending}
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<DialogFooter className="mt-4">
									<Button loading={mutation.isPending} type="submit">
										Continue
										<ArrowRightIcon className="size-4" />
									</Button>
								</DialogFooter>
							</form>
						</Form>
					) : (
						<>
							<BackupCodesPanel
								backupCodes={backupCodes}
								onSavedChange={setSavedBackupCodes}
								saved={savedBackupCodes}
							/>
							<DialogFooter className="mt-4">
								<Button
									disabled={!savedBackupCodes}
									onClick={handleDone}
									type="button"
								>
									Done
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		);
	});
