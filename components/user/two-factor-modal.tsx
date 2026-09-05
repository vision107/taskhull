"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import * as React from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

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
import { FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackupCodesGuard } from "@/hooks/use-backup-codes-guard";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";

export type TwoFactorModalProps = NiceModalHocProps;

export const TwoFactorModal = NiceModal.create<TwoFactorModalProps>(() => {
	const { user, reloadSession } = useSession();
	const actionPendingRef = React.useRef(false);

	const [view, setDialogView] = React.useState<
		"password" | "totp-url" | "backup-codes"
	>("password");
	const [totpURI, setTotpURI] = React.useState("");
	const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
	const [savedBackupCodes, setSavedBackupCodes] = React.useState(false);
	const [password, setPassword] = React.useState("");
	const [totpCode, setTotpCode] = React.useState("");
	const modal = useEnhancedModal({
		blockHistoryDismiss: () =>
			actionPendingRef.current ||
			(view === "backup-codes" && !savedBackupCodes),
	});

	const totpURISecret = React.useMemo(() => {
		if (!totpURI) {
			return null;
		}

		const url = new URL(totpURI);
		return url.searchParams.get("secret") || null;
	}, [totpURI]);

	const enableTwoFactorMutation = useMutation({
		mutationKey: ["enableTwoFactor"],
		mutationFn: async () => {
			const { data, error } = await authClient.twoFactor.enable({
				password,
			});

			if (error) {
				throw error;
			}

			setTotpURI(data.totpURI);
			setBackupCodes(data.backupCodes);
			setDialogView("totp-url");
		},

		onError: () => {
			toast.error(
				"Could not verify your account with the provided password. Please try again.",
			);
		},
		onSettled: () => {
			actionPendingRef.current = false;
		},
	});

	const disableTwoFactorMutation = useMutation({
		mutationKey: ["disableTwoFactor"],
		mutationFn: async () => {
			const { error } = await authClient.twoFactor.disable({
				password,
			});

			if (error) {
				throw error;
			}

			await reloadSession();
			modal.handleClose();

			toast.success(
				"Two-factor authentication has been disabled successfully.",
			);
		},

		onError: () => {
			toast.error(
				"Could not verify your account with the provided password. Please try again.",
			);
		},
		onSettled: () => {
			actionPendingRef.current = false;
		},
	});

	const verifyTwoFactorMutation = useMutation({
		mutationKey: ["verifyTwoFactor"],
		mutationFn: async (code: string) => {
			const { error } = await authClient.twoFactor.verifyTotp({
				code,
			});

			if (error) {
				throw error;
			}

			await reloadSession();
			setDialogView("backup-codes");
		},
		onError: () => {
			toast.error("Could not verify the one-time password. Please try again.");
		},
		onSettled: () => {
			actionPendingRef.current = false;
		},
	});

	const backupCodesMustBeSaved = view === "backup-codes" && !savedBackupCodes;
	const mutationIsPending =
		enableTwoFactorMutation.isPending ||
		disableTwoFactorMutation.isPending ||
		verifyTwoFactorMutation.isPending;
	const dismissIsLocked = mutationIsPending || backupCodesMustBeSaved;
	useBackupCodesGuard(dismissIsLocked);

	const handleOpenChange = (open: boolean): void => {
		if (!open && mutationIsPending) {
			return;
		}

		if (!open && backupCodesMustBeSaved) {
			toast.warning("Save your backup codes before closing this window.");
			return;
		}

		modal.handleOpenChange(open);
	};

	const handleSetupComplete = (): void => {
		if (!savedBackupCodes) {
			return;
		}

		modal.handleClose();
		toast.success("Two-factor authentication has been enabled successfully.");
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (actionPendingRef.current) {
			return;
		}
		actionPendingRef.current = true;

		if (user?.twoFactorEnabled) {
			disableTwoFactorMutation.mutate();
			return;
		}

		if (view === "password") {
			enableTwoFactorMutation.mutate();
			return;
		}

		const formData = new FormData(e.currentTarget);
		const code = formData.get("totpCode");
		verifyTwoFactorMutation.mutate(typeof code === "string" ? code : "");
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
						{view === "password"
							? "Verify with password"
							: view === "totp-url"
								? "Enable two-factor authentication"
								: "Save your backup codes"}
					</DialogTitle>
					<DialogDescription>
						{view === "password"
							? "Please verify your account by entering your password."
							: view === "totp-url"
								? "Use your preferred authenticator app and scan the QR code with it or enter the secret below manually to set up two-factor authentication."
								: "These codes will not be shown again. Save them before you continue."}
					</DialogDescription>
				</DialogHeader>
				{view === "password" ? (
					<form onSubmit={handleSubmit}>
						<div className="grid grid-cols-1 gap-4">
							<FormItem>
								<Label className="block">Your password:</Label>
								<InputPassword
									autoComplete="current-password"
									onChange={(e) => setPassword(e.target.value)}
									value={password}
								/>
							</FormItem>
						</div>
						<DialogFooter className="mt-4">
							<Button
								className="w-full"
								loading={
									enableTwoFactorMutation.isPending ||
									disableTwoFactorMutation.isPending
								}
								type="submit"
								variant="secondary"
							>
								Continue
								<ArrowRightIcon className="ml-1.5 size-4" />
							</Button>
						</DialogFooter>
					</form>
				) : view === "totp-url" ? (
					<form onSubmit={handleSubmit}>
						<div className="grid grid-cols-1 gap-4">
							<div className="flex flex-col items-center gap-4 px-6">
								<QRCode value={totpURI} />
								{totpURISecret && (
									<p className="text-center text-[10px] text-muted-foreground">
										{totpURISecret}
									</p>
								)}
							</div>
							<div className="grid grid-cols-1 gap-4">
								<FormItem>
									<Label className="block">
										Enter 6-digit code to verify the setup:
									</Label>
									<Input
										autoComplete="one-time-code"
										name="totpCode"
										onChange={(e) => setTotpCode(e.target.value)}
										value={totpCode}
									/>
								</FormItem>
							</div>
						</div>
						<DialogFooter className="mt-4">
							<Button
								disabled={verifyTwoFactorMutation.isPending}
								loading={verifyTwoFactorMutation.isPending}
								onClick={modal.handleClose}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								loading={verifyTwoFactorMutation.isPending}
								type="submit"
								variant="default"
							>
								Save
							</Button>
						</DialogFooter>
					</form>
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
								onClick={handleSetupComplete}
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
