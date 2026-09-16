"use client";

import { format } from "date-fns";
import {
	BellIcon,
	CheckCheckIcon,
	ChevronRightIcon,
	RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import {
	getNotificationTypeLabel,
	NotificationIcon,
} from "@/components/notifications/notification-icon";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type Notification = {
	id: string;
	title: string;
	message: string;
	type: string;
	actionUrl: string | null;
	readAt: Date | null;
	createdAt: Date;
};

function formatNotificationTime(createdAt: Date) {
	const elapsedMinutes = Math.max(
		0,
		Math.floor((Date.now() - createdAt.getTime()) / 60_000),
	);

	if (elapsedMinutes === 0) return "now";
	if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
	if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)}h`;
	if (elapsedMinutes < 10_080) return `${Math.floor(elapsedMinutes / 1_440)}d`;

	return format(createdAt, "MMM d");
}

export function getNotificationActionUrl(actionUrl: string | null) {
	return actionUrl && getSafeRedirectPath(actionUrl, "") === actionUrl
		? actionUrl
		: null;
}

const allNotificationsInput = { limit: 20, status: "all" as const };
const unreadNotificationsInput = { limit: 20, status: "unread" as const };
const notificationSkeletonRows = [
	{ titleWidth: "w-2/5", messageWidth: "w-4/5" },
] as const;

type NotificationListProps = {
	notifications: Notification[];
	emptyMessage: string;
	onSelect: (notification: Notification) => void;
};

export function NotificationList({
	notifications,
	emptyMessage,
	onSelect,
}: NotificationListProps) {
	const [expandedId, setExpandedId] = React.useState<string | null>(null);

	if (notifications.length === 0) {
		return (
			<p className="px-4 py-8 text-center text-sm text-muted-foreground">
				{emptyMessage}
			</p>
		);
	}

	return (
		<ul>
			{notifications.map((notification) => {
				const isUnread = !notification.readAt;
				const actionUrl = getNotificationActionUrl(notification.actionUrl);
				const isExpanded = expandedId === notification.id;
				const content = (
					<>
						<span className="relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
							<NotificationIcon type={notification.type} className="size-3.5" />
							{isUnread ? (
								<span
									className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-blue-500 ring-2 ring-popover"
									aria-hidden="true"
								/>
							) : null}
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-baseline gap-2">
								<p
									className={cn(
										"flex-1 text-sm",
										(!isExpanded || actionUrl) && "line-clamp-1",
										isUnread ? "font-semibold" : "font-medium",
									)}
								>
									<span className="sr-only">
										{isUnread ? "Unread" : "Read"}{" "}
										{getNotificationTypeLabel(notification.type)} notification:
									</span>
									{notification.title}
								</p>
								<span className="flex shrink-0 items-center gap-0.5 text-muted-foreground/70">
									<time
										dateTime={notification.createdAt.toISOString()}
										title={format(notification.createdAt, "PPpp")}
										className="text-[11px] tabular-nums"
										suppressHydrationWarning
									>
										{formatNotificationTime(notification.createdAt)}
									</time>
									{actionUrl ? (
										<ChevronRightIcon className="size-3" aria-hidden="true" />
									) : null}
								</span>
							</div>
							<p
								className={cn(
									"mt-1 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground",
									!isExpanded && "line-clamp-2",
								)}
							>
								{notification.message}
							</p>
						</div>
					</>
				);
				const itemClassName = cn(
					"flex w-full gap-3 border-b border-border/50 px-4 py-3.5 text-left last:border-b-0",
					"cursor-pointer transition-colors hover:bg-accent/40 focus-visible:bg-accent focus-visible:outline-none",
				);

				return (
					<li key={notification.id}>
						{actionUrl ? (
							<Link
								href={actionUrl}
								className={itemClassName}
								aria-label={`Open notification: ${notification.title}`}
								onClick={() => onSelect(notification)}
							>
								{content}
							</Link>
						) : (
							<button
								type="button"
								className={itemClassName}
								aria-label={`${isExpanded ? "Collapse" : "Expand"} notification: ${notification.title}`}
								aria-expanded={isExpanded}
								onClick={() => {
									onSelect(notification);
									setExpandedId((current) =>
										current === notification.id ? null : notification.id,
									);
								}}
							>
								{content}
							</button>
						)}
					</li>
				);
			})}
		</ul>
	);
}

export function NotificationListSkeleton() {
	const [visible, setVisible] = React.useState(false);

	React.useEffect(() => {
		const timeout = window.setTimeout(() => setVisible(true), 200);
		return () => window.clearTimeout(timeout);
	}, []);

	if (!visible) {
		return <div aria-hidden="true" className="min-h-20" />;
	}

	return (
		<div
			aria-label="Loading notifications"
			aria-live="polite"
			className="min-h-20"
			role="status"
		>
			{notificationSkeletonRows.map((row) => (
				<div
					key={row.titleWidth}
					className="flex gap-3 border-b border-border/50 px-4 py-3.5 last:border-b-0"
				>
					<Skeleton className="mt-0.5 size-7 shrink-0 rounded-md" />
					<div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
						<div className="flex items-center justify-between gap-3">
							<Skeleton className={cn("h-3.5", row.titleWidth)} />
							<Skeleton className="h-2.5 w-6 shrink-0" />
						</div>
						<Skeleton className="h-2.5 w-full" />
						<Skeleton className={cn("h-2.5", row.messageWidth)} />
					</div>
				</div>
			))}
		</div>
	);
}

export function NotificationListError({
	retrying,
	onRetry,
}: {
	retrying: boolean;
	onRetry: () => void;
}) {
	return (
		<div
			className="flex flex-col items-center gap-3 px-4 py-8 text-center"
			role="alert"
		>
			<div>
				<p className="text-sm font-medium">Could not load notifications</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Check your connection and try again.
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				size="xs"
				disabled={retrying}
				onClick={onRetry}
			>
				<RefreshCwIcon className={cn(retrying && "animate-spin")} />
				Try again
			</Button>
		</div>
	);
}

export function NotificationCenter({
	className,
	placement = "header",
}: {
	className?: string;
	placement?: "header" | "sidebar";
}) {
	const [open, setOpen] = React.useState(false);
	const [activeTab, setActiveTab] = React.useState<"all" | "unread">("all");
	const [hasOpened, setHasOpened] = React.useState(false);
	const utils = trpc.useUtils();
	const unread = trpc.notification.unreadCount.useQuery(undefined, {
		refetchInterval: 60_000,
		refetchOnWindowFocus: true,
	});
	const list = trpc.notification.list.useQuery(allNotificationsInput, {
		staleTime: 30_000,
		refetchInterval: open ? 30_000 : false,
	});
	const unreadList = trpc.notification.list.useQuery(unreadNotificationsInput, {
		enabled: open && activeTab === "unread",
		refetchInterval: open && activeTab === "unread" ? 30_000 : false,
	});
	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (nextOpen) {
			setActiveTab("all");
			setHasOpened(true);
			void utils.notification.list.prefetch(unreadNotificationsInput);
		} else {
			void utils.notification.list.invalidate(unreadNotificationsInput);
		}
	};
	const markAllRead = trpc.notification.markAllRead.useMutation({
		onMutate: async () => {
			await Promise.all([
				utils.notification.unreadCount.cancel(),
				utils.notification.list.cancel(allNotificationsInput),
				utils.notification.list.cancel(unreadNotificationsInput),
			]);
			const previousCount = utils.notification.unreadCount.getData();
			const previousList = utils.notification.list.getData(
				allNotificationsInput,
			);
			const previousUnreadList = utils.notification.list.getData(
				unreadNotificationsInput,
			);
			const readAt = new Date();
			utils.notification.unreadCount.setData(undefined, { count: 0 });
			utils.notification.list.setData(allNotificationsInput, (current) =>
				current?.map((notification) => ({ ...notification, readAt })),
			);
			utils.notification.list.setData(unreadNotificationsInput, []);
			return { previousCount, previousList, previousUnreadList };
		},
		onError: (_error, _input, context) => {
			utils.notification.unreadCount.setData(undefined, context?.previousCount);
			utils.notification.list.setData(
				allNotificationsInput,
				context?.previousList,
			);
			utils.notification.list.setData(
				unreadNotificationsInput,
				context?.previousUnreadList,
			);
			toast.error("Could not mark notifications as read.");
		},
		onSettled: () => {
			void Promise.allSettled([
				utils.notification.unreadCount.invalidate(),
				utils.notification.list.invalidate(),
			]);
		},
	});
	const markRead = trpc.notification.markRead.useMutation({
		onMutate: async ({ id }) => {
			await Promise.all([
				utils.notification.unreadCount.cancel(),
				utils.notification.list.cancel(allNotificationsInput),
				utils.notification.list.cancel(unreadNotificationsInput),
			]);
			const previousCount = utils.notification.unreadCount.getData();
			const previousList = utils.notification.list.getData(
				allNotificationsInput,
			);
			const previousUnreadList = utils.notification.list.getData(
				unreadNotificationsInput,
			);
			const fallbackUnreadCount =
				previousList?.filter((notification) => !notification.readAt).length ??
				previousUnreadList?.length ??
				1;
			utils.notification.unreadCount.setData(undefined, (current) => ({
				count: Math.max(0, (current?.count ?? fallbackUnreadCount) - 1),
			}));
			utils.notification.list.setData(allNotificationsInput, (current) =>
				current?.map((notification) =>
					notification.id === id
						? { ...notification, readAt: new Date() }
						: notification,
				),
			);
			utils.notification.list.setData(unreadNotificationsInput, (current) =>
				current?.filter((notification) => notification.id !== id),
			);
			return { previousCount, previousList, previousUnreadList };
		},
		onError: (_error, _input, context) => {
			utils.notification.unreadCount.setData(undefined, context?.previousCount);
			utils.notification.list.setData(
				allNotificationsInput,
				context?.previousList,
			);
			utils.notification.list.setData(
				unreadNotificationsInput,
				context?.previousUnreadList,
			);
			toast.error("Could not mark the notification as read.");
		},
		onSettled: () => {
			void Promise.allSettled([
				utils.notification.unreadCount.invalidate(),
				utils.notification.list.invalidate(allNotificationsInput),
				utils.notification.list.invalidate(unreadNotificationsInput),
			]);
		},
	});

	const notifications = list.data ?? [];
	const unreadNotifications = unreadList.data ?? [];
	const unreadCount =
		unread.data?.count ??
		notifications.filter((notification) => !notification.readAt).length;
	const handleSelect = (notification: Notification) => {
		if (!notification.readAt && !markRead.isPending && !markAllRead.isPending) {
			markRead.mutate({ id: notification.id });
		}
		if (getNotificationActionUrl(notification.actionUrl)) {
			handleOpenChange(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={cn(
						"relative shrink-0",
						placement === "sidebar" &&
							"border-0 bg-transparent shadow-none hover:bg-sidebar-accent focus-visible:ring-1 focus-visible:ring-ring/30",
						className,
					)}
					aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
				>
					<BellIcon className="size-4" />
					{unreadCount > 0 ? (
						<span
							aria-hidden="true"
							className={cn(
								"absolute flex items-center justify-center rounded-full bg-red-500 font-semibold text-white",
								placement === "sidebar"
									? "top-1 right-1 size-3.5 text-[8px]"
									: "top-0 right-0 size-4 text-[9px]",
							)}
						>
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					) : null}
				</Button>
			</PopoverTrigger>
			<span className="sr-only" aria-live="polite" aria-atomic="true">
				{hasOpened && (unread.isSuccess || (unread.isError && list.isSuccess))
					? unreadCount === 0
						? "No unread notifications"
						: `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
					: ""}
			</span>
			<PopoverContent
				aria-label="Notifications"
				align={placement === "sidebar" ? "start" : "end"}
				side="bottom"
				sideOffset={placement === "sidebar" ? 10 : 4}
				initialFocus={false}
				className="w-[min(21rem,calc(100vw-1rem))] gap-0 overflow-hidden p-0"
			>
				<div className="flex h-11 items-center justify-between gap-3 px-4">
					<h2 className="font-semibold">Notifications</h2>
					{unreadCount > 0 ? (
						<Button
							type="button"
							variant="ghost"
							size="xs"
							className="-mr-1 text-muted-foreground"
							disabled={markAllRead.isPending || markRead.isPending}
							onClick={() => markAllRead.mutate()}
						>
							<CheckCheckIcon />
							Mark all read
						</Button>
					) : null}
				</div>

				<Tabs
					value={activeTab}
					onValueChange={(value) =>
						setActiveTab(value === "unread" ? "unread" : "all")
					}
					className="gap-0"
				>
					<TabsList
						variant="line"
						className="h-8 w-full justify-start border-b px-3"
					>
						<TabsTrigger value="all" className="flex-none px-2.5">
							All
						</TabsTrigger>
						<TabsTrigger value="unread" className="flex-none px-2.5">
							Unread
						</TabsTrigger>
					</TabsList>

					<TabsContent
						value="all"
						className="max-h-80 min-h-20 overflow-y-auto"
					>
						{list.isPending ? (
							<NotificationListSkeleton />
						) : list.isError && !list.data ? (
							<NotificationListError
								retrying={list.isFetching}
								onRetry={() => void list.refetch()}
							/>
						) : (
							<NotificationList
								notifications={notifications}
								emptyMessage="No notifications"
								onSelect={handleSelect}
							/>
						)}
					</TabsContent>
					<TabsContent
						value="unread"
						className="max-h-80 min-h-20 overflow-y-auto"
					>
						{unreadList.isPending ? (
							<NotificationListSkeleton />
						) : unreadList.isError && !unreadList.data ? (
							<NotificationListError
								retrying={unreadList.isFetching}
								onRetry={() => void unreadList.refetch()}
							/>
						) : (
							<NotificationList
								notifications={unreadNotifications}
								emptyMessage="No unread notifications"
								onSelect={handleSelect}
							/>
						)}
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
}
