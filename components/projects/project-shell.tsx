"use client";

import {
	CopyIcon,
	GanttChartIcon,
	KanbanIcon,
	Loader2Icon,
	ListIcon,
	SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { CloneProjectDialog } from "@/components/projects/clone-project-dialog";
import { Button } from "@/components/ui/button";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface NavTab {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
}

interface ProjectShellProps {
	projectId: string;
	organization: { name: string; id: string };
	children: React.ReactNode;
}

export function ProjectShell({
	projectId,
	organization,
	children,
}: ProjectShellProps): React.JSX.Element {
	const pathname = usePathname();
	const [cloneOpen, setCloneOpen] = React.useState(false);
	const { data: project, isLoading } = trpc.organization.project.get.useQuery({
		id: projectId,
	});

	const base = `/dashboard/organization/projects/${projectId}`;

	const tabs: NavTab[] = [
		{ label: "List", href: `${base}/list`, icon: ListIcon },
		{ label: "Board", href: `${base}/board`, icon: KanbanIcon },
		{ label: "Gantt", href: `${base}/gantt`, icon: GanttChartIcon },
		{ label: "Settings", href: `${base}/settings`, icon: SettingsIcon },
	];

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{
								label: "Projects",
								href: "/dashboard/organization/projects",
							},
							{
								label: isLoading ? "…" : (project?.name ?? "Project"),
							},
						]}
					/>
				</PagePrimaryBar>

				{/* Project nav tabs */}
				<div className="border-b px-4 sm:px-6">
					{isLoading ? (
						<div className="flex h-10 items-center">
							<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
						</div>
					) : (
						<div className="flex items-center gap-1">
							{project && (
								<div className="mr-3 flex items-center gap-2 border-r pr-3">
									<div
										className="h-3 w-3 rounded-full"
										style={{ backgroundColor: project.color }}
									/>
									<span className="font-medium text-sm">{project.name}</span>
									{project.templateProjectId && (
										<span
											className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
											title="Cloned from another project"
										>
											Clone
										</span>
									)}
								</div>
							)}
							{tabs.map((tab) => {
								const isActive = pathname.startsWith(tab.href);
								return (
									<Link
										className={cn(
											"flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
											isActive
												? "border-primary text-foreground"
												: "border-transparent text-muted-foreground hover:text-foreground",
										)}
										href={tab.href}
										key={tab.href}
									>
										<tab.icon className="size-3.5" />
										{tab.label}
									</Link>
								);
							})}
							{project && (
								<Button
									className="ml-auto"
									onClick={() => setCloneOpen(true)}
									size="sm"
									variant="ghost"
								>
									<CopyIcon className="mr-1 size-3.5" />
									Clone
								</Button>
							)}
						</div>
					)}
				</div>
			</PageHeader>

			<PageBody>{children}</PageBody>

			{project && (
				<CloneProjectDialog
					onOpenChange={setCloneOpen}
					open={cloneOpen}
					sourceProject={{ id: project.id, name: project.name }}
				/>
			)}
		</Page>
	);
}
