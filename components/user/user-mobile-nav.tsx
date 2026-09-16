"use client";

import { HomeIcon, InboxIcon, SettingsIcon } from "lucide-react";
import type * as React from "react";

import {
	BottomNav,
	type BottomNavItem,
} from "@/components/app-shell/bottom-nav";
import { useWorkT } from "@/components/work/work-locale-provider";

/** Phone tabs for the account area (organization picker, inbox, settings). */
export function UserMobileNav(): React.JSX.Element {
	const t = useWorkT();

	const items: BottomNavItem[] = [
		{ label: t.nav.home, href: "/dashboard", icon: HomeIcon, exact: true },
		{ label: t.nav.inbox, href: "/dashboard/notifications", icon: InboxIcon },
		{
			label: t.nav.settings,
			href: "/dashboard/settings",
			icon: SettingsIcon,
		},
	];

	return <BottomNav items={items} />;
}
