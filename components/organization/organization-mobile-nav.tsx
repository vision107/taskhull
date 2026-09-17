"use client";

import {
	ClipboardCheckIcon,
	FactoryIcon,
	FileStackIcon,
	InboxIcon,
	LayoutDashboardIcon,
} from "lucide-react";
import type * as React from "react";

import {
	BottomNav,
	type BottomNavItem,
} from "@/components/app-shell/bottom-nav";
import { useWorkT } from "@/components/work/work-locale-provider";

/**
 * Phone tabs for the organization area. Workers get My tasks, Projects and
 * Inbox; planners additionally get Templates. Everything else is one tap away
 * behind the Menu tab.
 */
export function OrganizationMobileNav({
	canPlan,
}: {
	canPlan: boolean;
}): React.JSX.Element {
	const t = useWorkT();
	const basePath = "/dashboard/organization";

	const items: BottomNavItem[] = [
		{
			label: t.nav.myTasks,
			href: `${basePath}/my-tasks`,
			icon: ClipboardCheckIcon,
			activePrefixes: [`${basePath}/tasks`],
		},
		{ label: t.nav.projects, href: `${basePath}/projects`, icon: FactoryIcon },
		canPlan
			? {
					label: t.nav.templates,
					href: `${basePath}/templates`,
					icon: FileStackIcon,
				}
			: {
					label: t.nav.dashboard,
					href: basePath,
					icon: LayoutDashboardIcon,
					exact: true,
				},
		{ label: t.nav.inbox, href: "/dashboard/notifications", icon: InboxIcon },
	];

	return <BottomNav items={items} />;
}
