"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";

export type ConfirmationModalProps = NiceModalHocProps & {
	title: string;
	message?: string;
	cancelLabel?: string;
	confirmLabel?: string;
	destructive?: boolean;
	requiredText?: string;
	onConfirm: () =>
		| boolean
		| undefined
		| void
		| Promise<void>
		| Promise<boolean | undefined>;
};

export const ConfirmationModal = NiceModal.create<ConfirmationModalProps>(
	({
		title,
		message,
		cancelLabel,
		confirmLabel,
		destructive,
		requiredText,
		onConfirm,
	}) => {
		const [textInput, setTextInput] = useState("");
		const [showError, setShowError] = useState(false);
		const [isPending, setIsPending] = useState(false);
		const pendingRef = useRef(false);
		const modal = useEnhancedModal({
			blockHistoryDismiss: () => pendingRef.current,
		});

		const isTextValid = !requiredText || textInput === requiredText;

		const handleConfirm = async () => {
			if (isPending) return;
			if (!!requiredText && textInput !== requiredText) {
				setShowError(true);
				return;
			}
			pendingRef.current = true;
			setIsPending(true);
			try {
				const result = await onConfirm();
				if (result !== false) {
					modal.handleClose();
				}
			} catch (error) {
				console.error("Confirmation modal action failed", error);
				toast.error("Something went wrong. Please try again.");
			} finally {
				pendingRef.current = false;
				setIsPending(false);
			}
		};
		const handleOpenChange = (open: boolean) => {
			if (!open && isPending) return;
			modal.handleOpenChange(open);
		};

		const handleTextInputChange = (value: string) => {
			setTextInput(value);
			if (showError) {
				setShowError(false);
			}
		};

		return (
			<AlertDialog
				open={modal.visible}
				onOpenChange={handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{title}</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogDescription>{message}</AlertDialogDescription>

					{!!requiredText && (
						<div className="space-y-2">
							<Label htmlFor="confirmation-input">
								Type <strong>"{requiredText}"</strong> to confirm:
							</Label>
							<Input
								className={showError ? "border-destructive" : ""}
								id="confirmation-input"
								onChange={(e) => handleTextInputChange(e.target.value)}
								type="text"
								value={textInput}
							/>
							{showError && (
								<p className="text-sm text-destructive-foreground">
									Please type "{requiredText}" exactly to confirm.
								</p>
							)}
						</div>
					)}
					<AlertDialogFooter>
						<Button
							disabled={isPending}
							onClick={modal.handleClose}
							type="button"
							variant="outline"
						>
							{cancelLabel ?? "Cancel"}
						</Button>
						<Button
							disabled={!isTextValid || isPending}
							loading={isPending}
							onClick={handleConfirm}
							type="button"
							variant={destructive ? "destructive" : "default"}
						>
							{confirmLabel ?? "Confirm"}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	},
);
