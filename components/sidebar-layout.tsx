"use client";

import type * as React from "react";

import { SyncStatusPill } from "@/components/app-shell/sync-status-pill";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { OrganizationSwitcher } from "@/components/organization/organization-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
	SidebarRail,
} from "@/components/ui/sidebar";
import { UserDropDownMenu } from "@/components/user/user-dropdown-menu";
import { cn } from "@/lib/utils";

export type SidebarLayoutProps = React.PropsWithChildren<{
	menuItems: React.ReactNode;
	/** Phone tab bar rendered below `md`; the sidebar becomes a sheet there. */
	mobileNav?: React.ReactNode;
	defaultOpen?: boolean;
	defaultWidth?: string;
}>;

/**
 * Application shell. One layout for every screen size: a resizable sidebar
 * from `md` up, a bottom tab bar below. `--bottom-nav` exposes the height of
 * the tab bar so sticky elements (task action bar, sync pill) can clear it.
 */
export function SidebarLayout({
	menuItems,
	mobileNav,
	defaultOpen,
	defaultWidth,
	children,
}: SidebarLayoutProps): React.JSX.Element {
	return (
		<div
			className={cn(
				"group/shell flex h-dvh w-screen flex-col overflow-hidden bg-canvas",
				mobileNav
					? "has-bottom-nav [--bottom-nav:calc(3.5rem+env(safe-area-inset-bottom))] md:[--bottom-nav:0px]"
					: "[--bottom-nav:0px]",
			)}
		>
			<SidebarProvider defaultOpen={defaultOpen} defaultWidth={defaultWidth}>
				<Sidebar collapsible="icon">
					<SidebarHeader className="h-14 justify-center">
						<div className="flex w-full min-w-0 items-center justify-between gap-2">
							<div className="min-w-0 flex-1">
								<OrganizationSwitcher />
							</div>
							<NotificationCenter
								className="size-9 shrink-0 group-data-[collapsible=icon]:hidden"
								placement="sidebar"
							/>
						</div>
					</SidebarHeader>
					<SidebarContent className="flex flex-col overflow-hidden">
						<div className="flex-1 overflow-hidden">{menuItems}</div>
					</SidebarContent>
					<SidebarFooter>
						<UserDropDownMenu />
					</SidebarFooter>
					<SidebarRail />
				</Sidebar>
				<SidebarInset
					id="skip"
					className="size-full overflow-hidden bg-surface-1 pb-(--bottom-nav)"
				>
					{children}
				</SidebarInset>
				{mobileNav}
				<SyncStatusPill />
			</SidebarProvider>
		</div>
	);
}
