"use client";

import {
	ClipboardCheckIcon,
	FactoryIcon,
	FileStackIcon,
	LayoutDashboardIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

import { useWorkLocale } from "@/components/work/work-locale-provider";
import { cn } from "@/lib/utils";

/**
 * Phone tab bar for planners using the worker view: mirrors the sidebar's
 * "Application" group so the web dashboard is one tap away. Workers only have
 * their task list, so the layout does not render the bar for them.
 */
export function WorkBottomNav(): React.JSX.Element {
	const pathname = usePathname();
	const { t } = useWorkLocale();

	const items = [
		{
			label: t.nav.myTasks,
			href: "/dashboard/work",
			icon: ClipboardCheckIcon,
			isActive: pathname.startsWith("/dashboard/work"),
		},
		{
			label: t.nav.dashboard,
			href: "/dashboard/organization",
			icon: LayoutDashboardIcon,
			isActive: pathname === "/dashboard/organization",
		},
		{
			label: t.nav.projects,
			href: "/dashboard/organization/projects",
			icon: FactoryIcon,
			isActive: pathname.startsWith("/dashboard/organization/projects"),
		},
		{
			label: t.nav.templates,
			href: "/dashboard/organization/templates",
			icon: FileStackIcon,
			isActive: pathname.startsWith("/dashboard/organization/templates"),
		},
	];

	return (
		<nav
			aria-label={t.nav.label}
			className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
		>
			<ul className="mx-auto grid h-14 w-full max-w-lg grid-cols-4">
				{items.map((item) => (
					<li key={item.href} className="flex">
						<Link
							href={item.href}
							aria-current={item.isActive ? "page" : undefined}
							className={cn(
								"flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
								item.isActive
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<item.icon
								className={cn("size-5", item.isActive && "text-primary")}
								aria-hidden="true"
							/>
							<span className="truncate">{item.label}</span>
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
