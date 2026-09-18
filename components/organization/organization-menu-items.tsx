"use client";

import {
	ChevronRight,
	ClipboardCheckIcon,
	CreditCardIcon,
	FactoryIcon,
	FileStackIcon,
	LayoutDashboardIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

type MenuChild = {
	label: string;
	href: string;
};

type MenuItem = {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	external?: boolean;
	exactMatch?: boolean;
	activePrefixes?: string[];
	/** When set, the item expands to show these links under it. */
	children?: MenuChild[];
};

type MenuGroup = {
	label: string;
	items: MenuItem[];
};

export function OrganizationMenuItems({
	canPlan,
}: {
	canPlan: boolean;
}): React.JSX.Element {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { state } = useSidebar();
	const { t } = useWorkLocale();
	const isCollapsed = state === "collapsed";
	const basePath = "/dashboard/organization";

	const { data: projects } = trpc.organization.build.list.useQuery({});

	const projectChildren: MenuChild[] = (projects ?? []).map((project) => ({
		label: project.name ?? project.serialNumber,
		href: `${basePath}/projects/${project.id}`,
	}));

	const menuGroups: MenuGroup[] = [
		{
			label: "Application",
			items: [
				{
					label: t.nav.dashboard,
					href: basePath,
					icon: LayoutDashboardIcon,
					exactMatch: true,
				},
				{
					label: t.nav.myTasks,
					href: `${basePath}/my-tasks`,
					icon: ClipboardCheckIcon,
					activePrefixes: [`${basePath}/tasks`],
					children: [
						{
							label: t.nav.myList,
							href: `${basePath}/my-list`,
						},
					],
				},
				{
					label: t.nav.projects,
					href: `${basePath}/projects`,
					icon: FactoryIcon,
					children: projectChildren,
				},
				...(canPlan
					? [
							{
								label: t.nav.templates,
								href: `${basePath}/templates`,
								icon: FileStackIcon,
							},
						]
					: []),
			],
		},
		{
			label: "Settings",
			items: [
				{
					label: "General",
					href: `${basePath}/settings?tab=general`,
					icon: SettingsIcon,
				},
				{
					label: "Members",
					href: `${basePath}/settings?tab=members`,
					icon: UsersIcon,
				},
				{
					label: "Subscription",
					href: `${basePath}/settings?tab=subscription`,
					icon: CreditCardIcon,
				},
			],
		},
	];

	const getIsActive = React.useCallback(
		(
			item: Pick<
				MenuItem,
				"href" | "external" | "exactMatch" | "activePrefixes"
			>,
		): boolean => {
			if (item.external) {
				return false;
			}
			if (item.exactMatch) {
				return pathname === item.href;
			}
			if (item.activePrefixes?.some((prefix) => pathname.startsWith(prefix))) {
				return true;
			}
			if (item.href.includes("?")) {
				const [itemPath, itemQuery] = item.href.split("?");
				const itemParams = new URLSearchParams(itemQuery);
				const itemTab = itemParams.get("tab");
				const currentTab = searchParams.get("tab");

				if (pathname === itemPath) {
					if (currentTab === itemTab) return true;
					if (itemTab === "general" && !currentTab) return true;
				}
				return false;
			}
			return pathname.startsWith(item.href);
		},
		[pathname, searchParams],
	);

	return (
		<ScrollArea className="h-full" verticalScrollBar>
			<div className="flex min-h-full flex-col -space-y-1">
				{menuGroups.map((group) => (
					<SidebarGroup className="pb-1" key={group.label}>
						{group.label ? (
							<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						) : null}
						<SidebarMenu>
							{group.items.map((item) => {
								const isActive = getIsActive(item);
								if (item.children && !isCollapsed) {
									return (
										<CollapsibleNavItem
											key={item.href}
											item={item}
											isActive={isActive}
											emptyLabel={t.nav.noProjects}
											expandLabel={t.list.expand(item.label)}
											collapseLabel={t.list.collapse(item.label)}
										/>
									);
								}
								return (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={item.label}
										>
											<Link href={item.href}>
												<item.icon
													className={cn(
														"size-4 shrink-0",
														isActive
															? "text-foreground"
															: "text-muted-foreground",
													)}
												/>
												<span
													className={cn(
														isActive
															? "dark:text-foreground"
															: "dark:text-muted-foreground",
													)}
												>
													{item.label}
												</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</div>
		</ScrollArea>
	);
}

function CollapsibleNavItem({
	item,
	isActive,
	emptyLabel,
	expandLabel,
	collapseLabel,
}: {
	item: MenuItem;
	isActive: boolean;
	emptyLabel: string;
	expandLabel: string;
	collapseLabel: string;
}): React.JSX.Element {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const children = item.children ?? [];
	const childIsActive = children.some((child) =>
		isChildActive(child.href, pathname, searchParams),
	);
	const [open, setOpen] = React.useState(isActive || childIsActive);

	React.useEffect(() => {
		if (childIsActive) setOpen(true);
	}, [childIsActive]);

	return (
		<Collapsible
			className="group/collapsible"
			open={open}
			onOpenChange={setOpen}
		>
			<SidebarMenuItem>
				<SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
					<Link href={item.href}>
						<item.icon
							className={cn(
								"size-4 shrink-0",
								isActive ? "text-foreground" : "text-muted-foreground",
							)}
						/>
						<span
							className={cn(
								isActive
									? "dark:text-foreground"
									: "dark:text-muted-foreground",
							)}
						>
							{item.label}
						</span>
					</Link>
				</SidebarMenuButton>
				<CollapsibleTrigger asChild>
					<SidebarMenuAction
						aria-label={open ? collapseLabel : expandLabel}
						aria-expanded={open}
					>
						<ChevronRight
							className={cn(
								"transition-transform duration-200",
								open && "rotate-90",
							)}
						/>
					</SidebarMenuAction>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{children.length === 0 ? (
							<SidebarMenuSubItem>
								<span className="px-2 py-1.5 text-xs text-muted-foreground">
									{emptyLabel}
								</span>
							</SidebarMenuSubItem>
						) : (
							children.map((child) => {
								const active = isChildActive(
									child.href,
									pathname,
									searchParams,
								);
								return (
									<SidebarMenuSubItem key={child.href}>
										<SidebarMenuSubButton asChild isActive={active}>
											<Link href={child.href}>
												<span>{child.label}</span>
											</Link>
										</SidebarMenuSubButton>
									</SidebarMenuSubItem>
								);
							})
						)}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

function isChildActive(
	href: string,
	pathname: string,
	searchParams: URLSearchParams,
): boolean {
	const [path, query] = href.split("?");
	if (pathname !== path && !pathname.startsWith(`${path}/`)) {
		return false;
	}
	if (!query) {
		return pathname === path || pathname.startsWith(`${path}/`);
	}
	const expected = new URLSearchParams(query);
	for (const [key, value] of expected.entries()) {
		if (searchParams.get(key) !== value) return false;
	}
	return true;
}
