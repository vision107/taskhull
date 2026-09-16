"use client";

import { CheckCheckIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
	type Notification,
	NotificationList,
	NotificationListError,
	NotificationListSkeleton,
} from "@/components/notifications/notification-center";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/trpc/client";

const inboxInput = { limit: 100, status: "all" as const };
const unreadInboxInput = { limit: 100, status: "unread" as const };

/**
 * Full-page inbox. The bell popover stays for quick glances on desktop; this
 * is the destination behind the phone "Inbox" tab and notification taps.
 */
export function NotificationInbox(): React.JSX.Element {
	const [activeTab, setActiveTab] = React.useState<"all" | "unread">("all");
	const utils = trpc.useUtils();
	const list = trpc.notification.list.useQuery(inboxInput, {
		refetchOnWindowFocus: true,
	});
	const unreadList = trpc.notification.list.useQuery(unreadInboxInput, {
		enabled: activeTab === "unread",
	});
	const invalidate = () =>
		void Promise.allSettled([
			utils.notification.unreadCount.invalidate(),
			utils.notification.list.invalidate(),
		]);
	const markRead = trpc.notification.markRead.useMutation({
		onSettled: invalidate,
	});
	const markAllRead = trpc.notification.markAllRead.useMutation({
		onSettled: invalidate,
		onError: () => toast.error("Could not mark notifications as read."),
	});

	const notifications = list.data ?? [];
	const unreadCount = notifications.filter((item) => !item.readAt).length;

	const handleSelect = (notification: Notification) => {
		if (notification.readAt || markRead.isPending) return;
		markRead.mutate({ id: notification.id });
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="tracking-display text-xl font-semibold">Inbox</h1>
				{unreadCount > 0 && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-fg-secondary"
						disabled={markAllRead.isPending}
						onClick={() => markAllRead.mutate()}
					>
						<CheckCheckIcon />
						Mark all read
					</Button>
				)}
			</div>

			<Tabs
				value={activeTab}
				onValueChange={(value) =>
					setActiveTab(value === "unread" ? "unread" : "all")
				}
				className="gap-0"
			>
				<TabsList variant="line" className="h-9 w-full justify-start border-b">
					<TabsTrigger value="all" className="flex-none px-3">
						All
					</TabsTrigger>
					<TabsTrigger value="unread" className="flex-none px-3">
						Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="all" className="-mx-4 sm:mx-0">
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
							emptyMessage="No notifications yet"
							onSelect={handleSelect}
						/>
					)}
				</TabsContent>
				<TabsContent value="unread" className="-mx-4 sm:mx-0">
					{unreadList.isPending ? (
						<NotificationListSkeleton />
					) : unreadList.isError && !unreadList.data ? (
						<NotificationListError
							retrying={unreadList.isFetching}
							onRetry={() => void unreadList.refetch()}
						/>
					) : (
						<NotificationList
							notifications={unreadList.data ?? []}
							emptyMessage="You're all caught up"
							onSelect={handleSelect}
						/>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
