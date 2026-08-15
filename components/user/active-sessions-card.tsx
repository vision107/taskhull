"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	LaptopIcon,
	Loader2Icon,
	LogOutIcon,
	SmartphoneIcon,
	TabletIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

type DeviceType = "desktop" | "mobile" | "tablet";

function getSessionDetails(userAgent: string | null | undefined): {
	browser: string;
	deviceType: DeviceType;
	operatingSystem: string;
} {
	const value = userAgent ?? "";
	const browser = /HeadlessChrome/i.test(value)
		? "Headless Chrome"
		: /Edg\//i.test(value)
			? "Microsoft Edge"
			: /Chrome\//i.test(value)
				? "Chrome"
				: /Firefox\//i.test(value)
					? "Firefox"
					: /Safari\//i.test(value)
						? "Safari"
						: "Unknown browser";
	const operatingSystem = /iPad/i.test(value)
		? "iPadOS"
		: /iPhone|iPod/i.test(value)
			? "iOS"
			: /Android/i.test(value)
				? "Android"
				: /Mac OS X|Macintosh/i.test(value)
					? "macOS"
					: /Windows NT/i.test(value)
						? "Windows"
						: /Linux/i.test(value)
							? "Linux"
							: "Unknown OS";
	const deviceType: DeviceType = /iPad|Tablet/i.test(value)
		? "tablet"
		: /Mobile|iPhone|iPod|Android/i.test(value)
			? "mobile"
			: "desktop";

	return { browser, deviceType, operatingSystem };
}

function DeviceIcon({ type }: { type: DeviceType }): React.JSX.Element {
	if (type === "mobile") {
		return <SmartphoneIcon className="size-4" />;
	}
	if (type === "tablet") {
		return <TabletIcon className="size-4" />;
	}
	return <LaptopIcon className="size-4" />;
}

function formatSessionExpiry(expiresAt: Date | string): string {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(expiresAt));
}

function formatIpAddress(ipAddress: string | null | undefined): string {
	if (!ipAddress) {
		return "Unknown IP";
	}

	if (!ipAddress.includes(":")) {
		return ipAddress === "127.0.0.1" ? "Local session" : ipAddress;
	}

	const normalizedAddress = ipAddress.toLowerCase();
	if (normalizedAddress === "::" || normalizedAddress === "::1") {
		return "Local session";
	}
	if (normalizedAddress.includes("::")) {
		return normalizedAddress
			.split(":")
			.map((segment) => segment.replace(/^0+/, ""))
			.join(":");
	}

	const segments = normalizedAddress
		.split(":")
		.map((segment) => segment.replace(/^0+/, "") || "0");
	let longestStart = -1;
	let longestLength = 0;
	let currentStart = -1;

	for (let index = 0; index <= segments.length; index += 1) {
		if (segments[index] === "0") {
			if (currentStart === -1) currentStart = index;
			continue;
		}

		if (currentStart !== -1 && index - currentStart > longestLength) {
			longestStart = currentStart;
			longestLength = index - currentStart;
		}
		currentStart = -1;
	}

	const compactAddress =
		longestLength > 1
			? `${segments.slice(0, longestStart).join(":")}::${segments
					.slice(longestStart + longestLength)
					.join(":")}`
			: segments.join(":");

	return compactAddress === "::" ? "Local session" : compactAddress;
}

export function ActiveSessionsCard(): React.JSX.Element {
	const router = useProgressRouter();
	const utils = trpc.useUtils();
	const { session: currentSession } = useSession();
	const { data: activeSessions, isPending } =
		trpc.user.getActiveSessions.useQuery();
	const [isRevoking, setIsRevoking] = React.useState<string | null>(null);

	const sortedSessions = React.useMemo(() => {
		if (!activeSessions) return [];
		return [...activeSessions].sort((a, b) => {
			if (a.id === currentSession?.id) return -1;
			if (b.id === currentSession?.id) return 1;
			return 0;
		});
	}, [activeSessions, currentSession?.id]);

	const revokeSession = (token: string) => {
		setIsRevoking(token);
		void authClient.revokeSession(
			{
				token,
			},
			{
				onSuccess: async () => {
					toast.success("Session revoked");
					await utils.user.getActiveSessions.invalidate();
					await utils.user.getActiveSessions.refetch();
					router.refresh();
					setIsRevoking(null);
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || "Failed to revoke session");
					setIsRevoking(null);
				},
			},
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Active Sessions</CardTitle>
				<CardDescription>
					Review the devices signed in to your account and revoke access you do
					not recognize.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="overflow-hidden rounded-lg border">
					{isPending ? (
						<div className="flex items-center gap-3 p-4">
							<Skeleton className="size-9 shrink-0 rounded-lg" />
							<div className="min-w-0 flex-1">
								<Skeleton className="mb-2 h-4 w-40" />
								<Skeleton className="h-3 w-56 max-w-full" />
							</div>
							<Skeleton className="h-7 w-16 shrink-0" />
						</div>
					) : sortedSessions.length === 0 ? (
						<p className="p-4 text-sm text-muted-foreground">
							No active sessions found.
						</p>
					) : (
						<div className="divide-y">
							{sortedSessions.map((session) => {
								const isCurrent = session.id === currentSession?.id;
								const details = getSessionDetails(session.userAgent);
								return (
									<div
										className={cn(
											"flex items-center gap-3 p-4",
											isCurrent && "bg-muted/40",
										)}
										key={session.id}
									>
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
											<DeviceIcon type={details.deviceType} />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<p className="truncate text-sm font-medium">
													{details.browser} on {details.operatingSystem}
												</p>
												{isCurrent && (
													<Badge variant="secondary">Current</Badge>
												)}
											</div>
											<p className="truncate text-xs text-muted-foreground">
												{formatIpAddress(session.ipAddress)} · Expires{" "}
												{formatSessionExpiry(session.expiresAt)}
											</p>
										</div>
										{!isCurrent && (
											<Button
												className="shrink-0"
												size="sm"
												type="button"
												variant="destructive"
												disabled={isRevoking === session.token}
												onClick={() =>
													NiceModal.show(ConfirmationModal, {
														title: "Revoke session",
														message:
															"Are you sure you want to revoke this session? This will immediately sign out that device.",
														confirmLabel: "Revoke session",
														destructive: true,
														onConfirm: () => revokeSession(session.token),
													})
												}
											>
												{isRevoking === session.token ? (
													<Loader2Icon className="size-3.5 animate-spin" />
												) : (
													<LogOutIcon className="size-3.5" />
												)}
												Revoke
											</Button>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
