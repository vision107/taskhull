"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboardIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user/user-avatar";
import { appConfig } from "@/config/app.config";
import { authClient } from "@/lib/auth/client";

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
						<DropdownMenuLabel className="font-normal">
							<p className="truncate text-sm font-medium">{user.name}</p>
							<p className="truncate text-xs text-muted-foreground">
								{user.email}
							</p>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{canPlan && (
							<DropdownMenuItem
								onClick={() => router.push("/dashboard/organization")}
							>
								<LayoutDashboardIcon />
								Planner dashboard
							</DropdownMenuItem>
						)}
						<DropdownMenuItem onClick={handleSignOut}>
							<LogOutIcon />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
}
