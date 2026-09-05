"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { format } from "date-fns";
import Link from "next/link";

import {
	getNotificationTypeLabel,
	NotificationIcon,
} from "@/components/notifications/notification-icon";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

export type NotificationDetails = {
	title: string;
	message: string;
	type: string;
	actionUrl: string | null;
	readAt: Date | null;
	createdAt: Date;
	user: { name: string; email: string };
	createdBy: { name: string; email: string } | null;
};

export type NotificationDetailsModalProps = NiceModalHocProps & {
	notification: NotificationDetails;
};

export const NotificationDetailsModal =
	NiceModal.create<NotificationDetailsModalProps>(({ notification }) => {
		const modal = useEnhancedModal();
		const actionUrl =
			notification.actionUrl &&
			getSafeRedirectPath(notification.actionUrl, "") === notification.actionUrl
				? notification.actionUrl
				: null;

		return (
			<Sheet
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<SheetContent className="sm:max-w-lg">
					<SheetHeader>
						<SheetTitle>Notification details</SheetTitle>
						<SheetDescription>
							Review the message, recipient, delivery status, and action path.
						</SheetDescription>
					</SheetHeader>

					<div className="space-y-6 overflow-y-auto px-6 py-5">
						<div className="flex items-start gap-3 rounded-lg border p-4">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
								<NotificationIcon type={notification.type} className="size-4" />
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-semibold">{notification.title}</p>
									<Badge variant="secondary">
										{getNotificationTypeLabel(notification.type)}
									</Badge>
								</div>
								<p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
									{notification.message}
								</p>
							</div>
						</div>

						<dl className="grid gap-4 text-sm sm:grid-cols-2">
							<div>
								<dt className="text-muted-foreground">Recipient</dt>
								<dd className="mt-1 font-medium">{notification.user.name}</dd>
								<dd className="break-all text-muted-foreground">
									{notification.user.email}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Sent by</dt>
								<dd className="mt-1 font-medium">
									{notification.createdBy?.name ?? "System"}
								</dd>
								{notification.createdBy ? (
									<dd className="break-all text-muted-foreground">
										{notification.createdBy.email}
									</dd>
								) : null}
							</div>
							<div>
								<dt className="text-muted-foreground">Status</dt>
								<dd className="mt-1 font-medium">
									{notification.readAt ? "Read" : "Unread"}
								</dd>
								{notification.readAt ? (
									<dd>
										<time
											dateTime={notification.readAt.toISOString()}
											className="text-muted-foreground"
										>
											{format(notification.readAt, "dd MMM, yyyy, HH:mm")}
										</time>
									</dd>
								) : null}
							</div>
							<div>
								<dt className="text-muted-foreground">Sent</dt>
								<dd className="mt-1 font-medium">
									<time dateTime={notification.createdAt.toISOString()}>
										{format(notification.createdAt, "dd MMM, yyyy, HH:mm")}
									</time>
								</dd>
							</div>
						</dl>

						{actionUrl ? (
							<div>
								<p className="text-sm text-muted-foreground">Action path</p>
								<code className="mt-1 block rounded-md bg-muted px-3 py-2 text-sm break-all">
									{actionUrl}
								</code>
								<Link
									href={actionUrl}
									onNavigate={modal.dismissForNavigation}
									className={cn(
										buttonVariants({ variant: "outline", size: "sm" }),
										"mt-3",
									)}
								>
									Open destination
								</Link>
							</div>
						) : null}
					</div>
				</SheetContent>
			</Sheet>
		);
	});
