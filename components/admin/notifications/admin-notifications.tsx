"use client";

import NiceModal from "@ebay/nice-modal-react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { CreateNotificationModal } from "@/components/admin/notifications/create-notification-modal";
import { NotificationBulkActions } from "@/components/admin/notifications/notification-bulk-actions";
import { NotificationDetailsModal } from "@/components/admin/notifications/notification-details-modal";
import { ConfirmationModal } from "@/components/confirmation-modal";
import {
	getNotificationTypeLabel,
	NotificationIcon,
} from "@/components/notifications/notification-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	createSelectionColumn,
	DataTable,
	type FilterConfig,
} from "@/components/ui/custom/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appConfig } from "@/config/app.config";
import { trpc } from "@/trpc/client";

type NotificationRecord = {
	id: string;
	title: string;
	message: string;
	type: string;
	actionUrl: string | null;
	readAt: Date | null;
	createdAt: Date;
	user: {
		name: string;
		email: string;
	};
	createdBy: {
		name: string;
		email: string;
	} | null;
};

function NotificationRowActions({
	notification,
	onDeleted,
}: {
	notification: NotificationRecord;
	onDeleted: (id: string) => void;
}) {
	const utils = trpc.useUtils();
	const deleteNotification = trpc.admin.notification.bulkDelete.useMutation();

	return (
		<div className="flex justify-end">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 text-muted-foreground data-popup-open:bg-muted"
						onClick={(event) => event.stopPropagation()}
					>
						<MoreHorizontalIcon />
						<span className="sr-only">
							Open actions for {notification.title}
						</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					onClick={(event) => event.stopPropagation()}
				>
					<DropdownMenuItem
						onClick={() =>
							void NiceModal.show(NotificationDetailsModal, { notification })
						}
					>
						View details
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() => {
							void NiceModal.show(ConfirmationModal, {
								title: "Delete notification?",
								message:
									"It will also be removed from the recipient's notification center. This action cannot be undone.",
								confirmLabel: "Delete",
								destructive: true,
								onConfirm: async () => {
									try {
										await deleteNotification.mutateAsync({
											ids: [notification.id],
										});
										onDeleted(notification.id);
										void Promise.allSettled([
											utils.admin.notification.list.invalidate(),
											utils.notification.list.invalidate(),
											utils.notification.unreadCount.invalidate(),
										]);
										toast.success("Notification deleted.");
										return true;
									} catch {
										toast.error("Failed to delete notification.");
										return false;
									}
								},
							});
						}}
					>
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function createColumns(
	onDeleted: (id: string) => void,
): ColumnDef<NotificationRecord>[] {
	return [
		createSelectionColumn<NotificationRecord>(),
		{
			accessorKey: "title",
			header: "Notification",
			cell: ({ row }) => (
				<div className="flex max-w-md items-start gap-2.5">
					<span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/70">
						<NotificationIcon type={row.original.type} className="size-3.5" />
					</span>
					<div className="min-w-0">
						<p className="truncate font-medium" title={row.original.title}>
							<span className="sr-only">
								{getNotificationTypeLabel(row.original.type)} notification:
							</span>
							{row.original.title}
						</p>
						<p
							className="truncate text-xs text-muted-foreground"
							title={row.original.message}
						>
							{row.original.message}
						</p>
					</div>
				</div>
			),
		},
		{
			id: "recipient",
			header: "Recipient",
			cell: ({ row }) => (
				<div className="max-w-56 min-w-0">
					<p className="truncate" title={row.original.user.name}>
						{row.original.user.name}
					</p>
					<p
						className="truncate text-xs text-muted-foreground"
						title={row.original.user.email}
					>
						{row.original.user.email}
					</p>
				</div>
			),
		},
		{
			id: "createdBy",
			header: "Sent by",
			cell: ({ row }) =>
				row.original.createdBy ? (
					<div className="max-w-56 min-w-0">
						<p className="truncate" title={row.original.createdBy.name}>
							{row.original.createdBy.name}
						</p>
						<p
							className="truncate text-xs text-muted-foreground"
							title={row.original.createdBy.email}
						>
							{row.original.createdBy.email}
						</p>
					</div>
				) : (
					<span className="text-muted-foreground">System</span>
				),
		},
		{
			id: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge variant={row.original.readAt ? "secondary" : "default"}>
					{row.original.readAt ? "Read" : "Unread"}
				</Badge>
			),
		},
		{
			accessorKey: "createdAt",
			header: "Sent",
			cell: ({ row }) => (
				<time
					dateTime={row.original.createdAt.toISOString()}
					title={format(row.original.createdAt, "PPpp")}
					className="whitespace-nowrap text-foreground/80"
				>
					{format(row.original.createdAt, "dd MMM, yyyy, HH:mm")}
				</time>
			),
		},
		{
			id: "actions",
			enableSorting: false,
			cell: ({ row }) => (
				<NotificationRowActions
					notification={row.original}
					onDeleted={onDeleted}
				/>
			),
		},
	];
}

const notificationFilters: FilterConfig[] = [
	{
		key: "status",
		title: "Status",
		options: [
			{ value: "unread", label: "Unread" },
			{ value: "read", label: "Read" },
		],
	},
	{
		key: "type",
		title: "Type",
		options: [
			{ value: "info", label: "Information" },
			{ value: "success", label: "Success" },
			{ value: "warning", label: "Warning" },
		],
	},
];

export function AdminNotifications(): React.JSX.Element {
	const [searchQuery, setSearchQuery] = React.useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
	const [pageIndex, setPageIndex] = React.useState(0);
	const [pageSize, setPageSize] = React.useState(
		appConfig.pagination.defaultLimit,
	);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);
	const [rowSelection, setRowSelection] = React.useState<
		Record<string, boolean>
	>({});
	const handleDeleted = React.useCallback((id: string) => {
		setRowSelection((current) => {
			if (!current[id]) return current;
			const next = { ...current };
			delete next[id];
			return next;
		});
	}, []);
	const columns = React.useMemo(
		() => createColumns(handleDeleted),
		[handleDeleted],
	);
	const selectedStatuses = React.useMemo(() => {
		const value = columnFilters.find((filter) => filter.id === "status")?.value;
		return Array.isArray(value) ? (value as string[]) : [];
	}, [columnFilters]);
	const selectedTypes = React.useMemo(() => {
		const value = columnFilters.find((filter) => filter.id === "type")?.value;
		return Array.isArray(value) ? (value as string[]) : [];
	}, [columnFilters]);
	React.useEffect(() => {
		const timeout = window.setTimeout(
			() => setDebouncedSearchQuery(searchQuery),
			300,
		);
		return () => window.clearTimeout(timeout);
	}, [searchQuery]);
	const notifications = trpc.admin.notification.list.useQuery(
		{
			query: debouncedSearchQuery,
			limit: pageSize,
			offset: pageIndex * pageSize,
			statuses: selectedStatuses as ("read" | "unread")[],
			types: selectedTypes as ("info" | "success" | "warning")[],
		},
		{ placeholderData: (previous) => previous },
	);
	const data = (notifications.data?.notifications ??
		[]) as NotificationRecord[];
	React.useEffect(() => {
		if (!notifications.data) return;

		const lastPageIndex = Math.max(
			0,
			Math.ceil(notifications.data.total / pageSize) - 1,
		);
		if (pageIndex > lastPageIndex) {
			setPageIndex(lastPageIndex);
			setRowSelection({});
		}
	}, [notifications.data, pageIndex, pageSize]);
	const handleSearchQueryChange = (value: string) => {
		setSearchQuery(value);
		setPageIndex(0);
		setRowSelection({});
	};
	const handleFiltersChange = (filters: ColumnFiltersState) => {
		setColumnFilters(filters);
		setPageIndex(0);
		setRowSelection({});
	};

	return (
		<div className="flex flex-col gap-4">
			{notifications.isError ? (
				<Alert variant="destructive">
					<AlertCircleIcon />
					<AlertTitle>Could not load notification history</AlertTitle>
					<AlertDescription>
						<p>{notifications.error.message}</p>
						<Button
							type="button"
							variant="outline"
							size="xs"
							disabled={notifications.isFetching}
							onClick={() => void notifications.refetch()}
						>
							<RefreshCwIcon
								className={
									notifications.isFetching ? "animate-spin" : undefined
								}
							/>
							Try again
						</Button>
					</AlertDescription>
				</Alert>
			) : null}
			<DataTable
				columnFilters={columnFilters}
				columns={columns}
				data={data}
				emptyMessage={
					!searchQuery &&
					selectedStatuses.length === 0 &&
					selectedTypes.length === 0
						? "No notifications have been sent."
						: "No notifications match your search or filters."
				}
				enableFilters
				enableRowSelection
				enableSearch
				filters={notificationFilters}
				getRowId={(notification) => notification.id}
				loading={notifications.isPending}
				onRowClick={(notification) =>
					void NiceModal.show(NotificationDetailsModal, { notification })
				}
				onFiltersChange={handleFiltersChange}
				onPageIndexChange={(index) => {
					setPageIndex(index);
					setRowSelection({});
				}}
				onPageSizeChange={(size) => {
					setPageSize(size);
					setPageIndex(0);
					setRowSelection({});
				}}
				onRowSelectionChange={setRowSelection}
				onSearchQueryChange={handleSearchQueryChange}
				renderBulkActions={() => (
					<NotificationBulkActions
						rowSelection={rowSelection}
						onClearSelection={() => setRowSelection({})}
					/>
				)}
				rowSelection={rowSelection}
				pageIndex={pageIndex}
				pageSize={pageSize}
				searchPlaceholder="Search notifications or users..."
				searchQuery={searchQuery}
				toolbarActions={
					<Button
						type="button"
						size="sm"
						onClick={() => void NiceModal.show(CreateNotificationModal)}
					>
						<PlusIcon className="size-4 shrink-0" />
						Send notification
					</Button>
				}
				totalCount={notifications.data?.total ?? 0}
			/>
		</div>
	);
}
