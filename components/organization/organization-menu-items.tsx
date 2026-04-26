"use client";

import {
	BotIcon,
	ChevronRight,
	CircleIcon,
	CoinsIcon,
	CreditCardIcon,
	FolderKanbanIcon,
	ListChecksIcon,
	PlusIcon,
	SettingsIcon,
	StarIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	SidebarGroup,
	SidebarGroupAction,
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
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

type MenuItem = {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	external?: boolean;
	exactMatch?: boolean;
};

type MenuGroup = {
	label: string;
	items: MenuItem[];
	collapsible?: boolean;
	defaultOpen?: boolean;
};

const basePath = "/dashboard/organization";

export function OrganizationMenuItems(): React.JSX.Element {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { state } = useSidebar();
	const [createProjectOpen, setCreateProjectOpen] = React.useState(false);

	const menuGroups: MenuGroup[] = [
		{
			label: "Application",
			items: [
				{
					label: "My Tasks",
					href: basePath,
					icon: ListChecksIcon,
					exactMatch: true,
				},
				{
					label: "AI Chatbot",
					href: `${basePath}/chatbot`,
					icon: BotIcon,
				},
			],
			collapsible: false,
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
				{
					label: "Credits",
					href: `${basePath}/settings?tab=credits`,
					icon: CoinsIcon,
				},
			],
			collapsible: false,
		},
	];

	const getIsActive = React.useCallback(
		(item: MenuItem): boolean => {
			if (item.external) {
				return false;
			}
			if (item.exactMatch) {
				return pathname === item.href;
			}
			// Check if the href contains query params
			if (item.href.includes("?")) {
				const [itemPath, itemQuery] = item.href.split("?");
				const itemParams = new URLSearchParams(itemQuery);
				const itemTab = itemParams.get("tab");
				const currentTab = searchParams.get("tab");

				// Match if pathname matches and either:
				// 1. tabs match exactly, or
				// 2. item is the default tab (general) and no tab is set in URL
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

	const isCollapsed = state === "collapsed";

	return (
		<ScrollArea
			className="[&>[data-radix-scroll-area-viewport]>div]:flex! h-full [&>[data-radix-scroll-area-viewport]>div]:h-full [&>[data-radix-scroll-area-viewport]>div]:flex-col [&>[data-radix-scroll-area-viewport]>div]:-space-y-1"
			verticalScrollBar
		>
			{menuGroups.map((group, groupIndex) => (
				<SidebarGroup className="pb-1" key={groupIndex}>
					{group.label && (
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
					)}
					<SidebarMenu>
						{group.items.map((item, itemIndex) => {
							const isActive = getIsActive(item);
							return (
								<SidebarMenuItem key={itemIndex}>
									<SidebarMenuButton
										asChild
										isActive={isActive}
										tooltip={item.label}
									>
										<Link
											href={item.href}
											{...(item.external && {
												target: "_blank",
												rel: "noopener noreferrer",
											})}
										>
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

			<ProjectsTree
				isCollapsed={isCollapsed}
				onNewProject={() => setCreateProjectOpen(true)}
			/>

			<CreateProjectDialog
				onOpenChange={setCreateProjectOpen}
				open={createProjectOpen}
			/>
		</ScrollArea>
	);
}

// ─── Projects tree ────────────────────────────────────────────────────────────

interface ProjectsTreeProps {
	isCollapsed: boolean;
	onNewProject: () => void;
}

function ProjectsTree({
	isCollapsed,
	onNewProject,
}: ProjectsTreeProps): React.JSX.Element {
	const pathname = usePathname();
	const { data: projects, isLoading } =
		trpc.organization.project.list.useQuery();

	// Hide template projects from the sidebar tree; surface them elsewhere.
	const visibleProjects = React.useMemo(
		() => (projects ?? []).filter((p) => !p.isTemplate),
		[projects],
	);

	const favorites = React.useMemo(
		() => visibleProjects.filter((p) => p.isFavorite),
		[visibleProjects],
	);
	const nonFavorites = React.useMemo(
		() => visibleProjects.filter((p) => !p.isFavorite),
		[visibleProjects],
	);

	if (isCollapsed) {
		// In collapsed mode, fall back to a single Projects icon link.
		const isActive = pathname.startsWith(`${basePath}/projects`);
		return (
			<SidebarGroup className="pb-1">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							isActive={isActive}
							tooltip="Projects"
						>
							<Link href={`${basePath}/projects`}>
								<FolderKanbanIcon
									className={cn(
										"size-4 shrink-0",
										isActive
											? "text-foreground"
											: "text-muted-foreground",
									)}
								/>
								<span>Projects</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroup>
		);
	}

	return (
		<>
			{favorites.length > 0 && (
				<SidebarGroup className="pb-1">
					<SidebarGroupLabel>Favorites</SidebarGroupLabel>
					<SidebarMenu>
						{favorites.map((project) => (
							<ProjectNode
								key={project.id}
								pathname={pathname}
								project={project}
							/>
						))}
					</SidebarMenu>
				</SidebarGroup>
			)}

			<SidebarGroup className="pb-1">
				<SidebarGroupLabel>Projects</SidebarGroupLabel>
				<SidebarGroupAction
					onClick={onNewProject}
					title="New project"
				>
					<PlusIcon className="size-3.5" />
					<span className="sr-only">New project</span>
				</SidebarGroupAction>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							isActive={
								pathname === `${basePath}/projects` ||
								pathname === `${basePath}/projects/`
							}
							tooltip="All projects"
						>
							<Link href={`${basePath}/projects`}>
								<FolderKanbanIcon className="size-4 shrink-0 text-muted-foreground" />
								<span>All projects</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>

					{isLoading && nonFavorites.length === 0 && (
						<SidebarMenuItem>
							<div className="px-2 py-1.5 text-muted-foreground text-xs">
								Loading…
							</div>
						</SidebarMenuItem>
					)}

					{nonFavorites.map((project) => (
						<ProjectNode
							key={project.id}
							pathname={pathname}
							project={project}
						/>
					))}
				</SidebarMenu>
			</SidebarGroup>
		</>
	);
}

interface ProjectNodeProps {
	project: {
		id: string;
		name: string;
		color: string;
		isFavorite: boolean;
	};
	pathname: string;
}

function ProjectNode({ project, pathname }: ProjectNodeProps) {
	const projectPath = `${basePath}/projects/${project.id}`;
	const isInProject = pathname.startsWith(projectPath);
	const [open, setOpen] = React.useState(isInProject);
	const utils = trpc.useUtils();

	React.useEffect(() => {
		if (isInProject) setOpen(true);
	}, [isInProject]);

	const favorite = trpc.organization.project.favorite.useMutation({
		onSuccess: () => utils.organization.project.list.invalidate(),
	});
	const unfavorite = trpc.organization.project.unfavorite.useMutation({
		onSuccess: () => utils.organization.project.list.invalidate(),
	});

	const toggleFavorite = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (project.isFavorite) {
			unfavorite.mutate({ projectId: project.id });
		} else {
			favorite.mutate({ projectId: project.id });
		}
	};

	const tabs: Array<{ label: string; href: string }> = [
		{ label: "List", href: `${projectPath}/list` },
		{ label: "Board", href: `${projectPath}/board` },
		{ label: "Gantt", href: `${projectPath}/gantt` },
		{ label: "Settings", href: `${projectPath}/settings` },
	];

	return (
		<Collapsible
			asChild
			className="group/collapsible"
			onOpenChange={setOpen}
			open={open}
		>
			<SidebarMenuItem>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton
						className="group/project"
						isActive={isInProject}
						tooltip={project.name}
					>
						<ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
						<span
							className="h-2 w-2 shrink-0 rounded-full"
							style={{ backgroundColor: project.color }}
						/>
						<span className="truncate">{project.name}</span>
					</SidebarMenuButton>
				</CollapsibleTrigger>

				<SidebarMenuAction
					className="opacity-0 group-hover/project:opacity-100 data-[active=true]:opacity-100"
					data-active={project.isFavorite}
					onClick={toggleFavorite}
					showOnHover
					title={
						project.isFavorite ? "Remove favorite" : "Add to favorites"
					}
				>
					<StarIcon
						className={cn(
							"size-3.5",
							project.isFavorite
								? "fill-yellow-400 text-yellow-400"
								: "text-muted-foreground",
						)}
					/>
					<span className="sr-only">Toggle favorite</span>
				</SidebarMenuAction>

				<CollapsibleContent>
					<SidebarMenuSub className="ml-3.5 border-0">
						{tabs.map((tab) => {
							const isActive = pathname.startsWith(tab.href);
							return (
								<SidebarMenuSubItem key={tab.href}>
									<SidebarMenuSubButton asChild isActive={isActive}>
										<Link href={tab.href}>
											<CircleIcon className="size-3 shrink-0" />
											<span>{tab.label}</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							);
						})}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}
