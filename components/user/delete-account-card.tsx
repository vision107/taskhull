"use client";

import NiceModal from "@ebay/nice-modal-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { authConfig } from "@/config/auth.config";
import { useProgressRouter } from "@/hooks/use-progress-router";
import {
	ACCOUNT_DELETION_BLOCKED_MESSAGE,
	isAccountDeletionBlockedError,
} from "@/lib/auth/account-deletion-errors";
import { authClient } from "@/lib/auth/client";

export function DeleteAccountCard(): React.JSX.Element {
	const queryClient = useQueryClient();
	const router = useProgressRouter();

	const deleteUserMutation = useMutation({
		mutationFn: async () => {
			const { error } = await authClient.deleteUser({});

			if (error) {
				throw error;
			}
		},
		onSuccess: () => {
			toast.success("Account was deleted successfully");

			// Clear the query cache to prevent any user data from persisting
			queryClient.clear();

			// Preserve device-level preferences
			const theme = localStorage.getItem("theme");
			const cookieConsent = localStorage.getItem("cookie_consent");

			localStorage.clear();
			sessionStorage.clear();

			// Restore device-level preferences
			if (theme) localStorage.setItem("theme", theme);
			if (cookieConsent) localStorage.setItem("cookie_consent", cookieConsent);

			router.refresh();
			window.location.href = new URL(
				authConfig.redirectAfterLogout,
				window.location.origin,
			).toString();
		},
		onError: (error) => {
			toast.error(
				isAccountDeletionBlockedError(error)
					? ACCOUNT_DELETION_BLOCKED_MESSAGE
					: "Could not delete account",
			);
		},
	});

	const confirmDelete = () => {
		void NiceModal.show(ConfirmationModal, {
			title: "Delete account",
			message:
				"Are you sure you want to delete your account? You must transfer ownership or delete any organization you solely own first.",
			destructive: true,
			confirmLabel: "Delete account",
			onConfirm: async () => {
				try {
					await deleteUserMutation.mutateAsync();
				} catch {
					return false;
				}
			},
		});
	};

	return (
		<Card className="border border-destructive">
			<CardHeader>
				<CardTitle>Danger Zone</CardTitle>
				<CardDescription>
					This section contains actions that are irreversible.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col space-y-4">
					<div className="flex flex-col space-y-1">
						<span className="text-sm font-medium">Delete your Account</span>
						<p className="text-sm text-muted-foreground">
							This permanently deletes your account. Organizations you solely
							own must be transferred or deleted first. This action cannot be
							undone.
						</p>
					</div>
					<div>
						<Button
							type="button"
							variant="destructive"
							onClick={() => confirmDelete()}
						>
							Delete your Account
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
