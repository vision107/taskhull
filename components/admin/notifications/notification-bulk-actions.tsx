"use client";

import NiceModal from "@ebay/nice-modal-react";
import type * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import {
	type BulkActionItem,
	DataTableBulkActions,
	getSelectedRowIds,
} from "@/components/ui/custom/data-table";
import { trpc } from "@/trpc/client";

export function NotificationBulkActions({
	rowSelection,
	onClearSelection,
}: {
	rowSelection: Record<string, boolean>;
	onClearSelection: () => void;
}): React.JSX.Element {
	const utils = trpc.useUtils();
	const bulkDelete = trpc.admin.notification.bulkDelete.useMutation();

	const actions: BulkActionItem[] = [
		{
			label: "Delete",
			variant: "destructive",
			onClick: () => {
				const ids = getSelectedRowIds(rowSelection);
				if (ids.length === 0) return;

				void NiceModal.show(ConfirmationModal, {
					title: "Delete notifications?",
					message: `Delete ${ids.length} notification${ids.length === 1 ? "" : "s"}? They will also be removed from the recipients' notification centers. This action cannot be undone.`,
					confirmLabel: "Delete",
					destructive: true,
					onConfirm: async () => {
						try {
							const result = await bulkDelete.mutateAsync({ ids });
							toast.success(
								`${result.count} notification${result.count === 1 ? "" : "s"} deleted.`,
							);
							onClearSelection();
							void Promise.allSettled([
								utils.admin.notification.list.invalidate(),
								utils.notification.list.invalidate(),
								utils.notification.unreadCount.invalidate(),
							]);
							return true;
						} catch {
							toast.error("Failed to delete notifications.");
							return false;
						}
					},
				});
			},
		},
	];

	return <DataTableBulkActions actions={actions} rowSelection={rowSelection} />;
}
