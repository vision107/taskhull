"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	BellIcon,
	BellOffIcon,
	CloudOffIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user/user-avatar";
import { useOffline } from "@/components/work/offline-provider";
import { appConfig } from "@/config/app.config";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export function WorkHeader({
	organizationName,
	user,
	canPlan,
}: {
	organizationName: string;
	user: { name: string; email: string; image: string | null };
	canPlan: boolean;
}): React.JSX.Element {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { online, pending, syncing, flush, push } = useOffline();

	const handleSignOut = async () => {
		try {
			await authClient.signOut();
		} finally {
			queryClient.clear();
			router.push("/auth/sign-in");
		}
	};

	return (
		<header className="sticky top-0 z-20 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
			<div className="mx-auto flex h-12 w-full max-w-lg items-center justify-between px-4">
				<Link
					href="/dashboard/work"
					className="flex min-w-0 items-center gap-2"
				>
					<span className="font-semibold">{appConfig.appName}</span>
					<span className="truncate text-xs text-muted-foreground">
						{organizationName}
					</span>
				</Link>
				<div className="flex items-center gap-2">
					{(!online || pending.length > 0) && (
						<button
							type="button"
							onClick={() => void flush()}
							disabled={!online || syncing}
							className={cn(
								"flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
								online
									? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
									: "border-border bg-muted text-muted-foreground",
							)}
							aria-label={
								online
									? `${pending.length} changes waiting to sync`
									: "You are offline"
							}
						>
							{online ? (
								<RefreshCwIcon
									className={cn("size-3", syncing && "animate-spin")}
								/>
							) : (
								<CloudOffIcon className="size-3" />
							)}
							{online ? `${pending.length} to sync` : "Offline"}
						</button>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="rounded-full"
								aria-label="Account menu"
							>
								<UserAvatar
									name={user.name}
									src={user.image}
									className="size-8"
								/>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuGroup>
								<DropdownMenuLabel className="font-normal">
									<p className="truncate text-sm font-medium">{user.name}</p>
									<p className="truncate text-xs text-muted-foreground">
										{user.email}
									</p>
								</DropdownMenuLabel>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							{canPlan && (
								<DropdownMenuItem
									onClick={() => router.push("/dashboard/organization")}
								>
									<LayoutDashboardIcon />
									Planner dashboard
								</DropdownMenuItem>
							)}
							{push.supported && push.enabled && (
								<DropdownMenuItem
									disabled={push.busy}
									onClick={() => void push.toggle()}
								>
									{push.subscribed ? <BellOffIcon /> : <BellIcon />}
									{push.subscribed
										? "Turn off push notifications"
										: "Enable push notifications"}
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onClick={handleSignOut}>
								<LogOutIcon />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
