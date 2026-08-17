"use client";

import NiceModal from "@ebay/nice-modal-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useProgressRouter } from "@/hooks/use-progress-router";
import { authClient } from "@/lib/auth/client";
import { trpc } from "@/trpc/client";
import { clearOrganizationScopedQueries } from "@/trpc/query-client";

interface DeleteOrganizationCardProps {
	canDelete: boolean;
}

export function DeleteOrganizationCard({
	canDelete,
}: DeleteOrganizationCardProps): React.JSX.Element {
	const router = useProgressRouter();
	const queryClient = useQueryClient();
	const utils = trpc.useUtils();
	const { data: organization } = authClient.useActiveOrganization();

	const handleDelete = () => {
		if (!canDelete || !organization) {
			return;
		}

		void NiceModal.show(ConfirmationModal, {
			title: "Delete Organization",
			message: `Are you sure you want to delete the organization "${organization.name}"? This action cannot be undone and all data will be permanently deleted.`,
			destructive: true,
			requiredText: organization.name,
			confirmLabel: "Delete Organization",
			onConfirm: async () => {
				const { error } = await authClient.organization.delete({
					organizationId: organization.id,
				});

				if (error) {
					toast.error(
						"We were unable to delete your organization. Please try again later.",
					);
					return;
				}

				// Explicitly unset the active organization
				await authClient.organization.setActive({
					organizationId: null,
				});

				// Clear organization-scoped queries to prevent stale data
				clearOrganizationScopedQueries(queryClient);

				toast.success("Your organization has been deleted.");
				await Promise.all([
					utils.organization.list.invalidate(),
					utils.admin.organization.list.invalidate(),
				]);
				router.replace("/dashboard");
			},
		});
	};

	return (
		<Card className="border border-destructive">
			<CardHeader>
				<CardTitle>Danger Zone</CardTitle>
				<CardDescription>
					{canDelete
						? "This section contains actions that are irreversible."
						: "Only the organization owner can delete this organization."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col space-y-4">
					<div className="flex flex-col space-y-1">
						<span className="text-sm font-medium">Delete Organization</span>
						<p className="text-sm text-muted-foreground">
							This action cannot be undone. All data associated with this
							organization will be deleted.
						</p>
					</div>
					<div>
						<Button
							type="button"
							variant="destructive"
							onClick={handleDelete}
							disabled={!canDelete}
						>
							Delete Organization
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
