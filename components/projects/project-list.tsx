"use client";

import {
	CalendarIcon,
	CopyIcon,
	FolderKanbanIcon,
	Loader2Icon,
	MoreHorizontalIcon,
	PlusIcon,
	StarIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { CloneProjectDialog } from "@/components/projects/clone-project-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

const STATUS_COLORS: Record<string, string> = {
	active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	paused:
		"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
	completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	archived: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

interface ProjectCardInfo {
	id: string;
	name: string;
	color: string;
	status: string;
	description: string | null;
	isFavorite: boolean;
	members: Array<unknown>;
	endDate: Date | null;
	templateProjectId: string | null;
}

export function ProjectList(): React.JSX.Element {
	const [createOpen, setCreateOpen] = React.useState(false);
	const [cloneFrom, setCloneFrom] = React.useState<{
		id: string;
		name: string;
	} | null>(null);
	const { data: projects, isLoading } =
		trpc.organization.project.list.useQuery();

	const utils = trpc.useUtils();
	const favorite = trpc.organization.project.favorite.useMutation({
		onSuccess: () => utils.organization.project.list.invalidate(),
	});
	const unfavorite = trpc.organization.project.unfavorite.useMutation({
		onSuccess: () => utils.organization.project.list.invalidate(),
	});

	const toggleFavorite = (project: ProjectCardInfo) => {
		if (project.isFavorite) {
			unfavorite.mutate({ projectId: project.id });
		} else {
			favorite.mutate({ projectId: project.id });
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const visibleProjects = (projects ?? []) as ProjectCardInfo[];
	const favorites = visibleProjects.filter((p) => p.isFavorite);
	const rest = visibleProjects.filter((p) => !p.isFavorite);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Projects</h1>
					<p className="text-muted-foreground text-sm">
						Plan product iterations and clone proven setups for the next run
					</p>
				</div>
				<Button onClick={() => setCreateOpen(true)}>
					<PlusIcon className="mr-2 size-4" />
					New Project
				</Button>
			</div>

			{visibleProjects.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
					<FolderKanbanIcon className="mb-4 size-10 text-muted-foreground/50" />
					<h3 className="mb-1 font-medium text-lg">No projects yet</h3>
					<p className="mb-6 max-w-sm text-muted-foreground text-sm">
						Create your first project to start planning tasks, building Gantt
						charts, and collaborating with your team.
					</p>
					<Button onClick={() => setCreateOpen(true)}>
						<PlusIcon className="mr-2 size-4" />
						Create Project
					</Button>
				</div>
			) : (
				<div className="space-y-8">
					{favorites.length > 0 && (
						<ProjectGrid
							label="Favorites"
							onClone={(p) => setCloneFrom({ id: p.id, name: p.name })}
							onToggleFavorite={toggleFavorite}
							projects={favorites}
						/>
					)}
					<ProjectGrid
						label={favorites.length > 0 ? "All projects" : undefined}
						onClone={(p) => setCloneFrom({ id: p.id, name: p.name })}
						onToggleFavorite={toggleFavorite}
						projects={rest}
					/>
				</div>
			)}

			<CreateProjectDialog
				onOpenChange={setCreateOpen}
				open={createOpen}
			/>

			{cloneFrom && (
				<CloneProjectDialog
					onOpenChange={(open) => {
						if (!open) setCloneFrom(null);
					}}
					open={true}
					sourceProject={cloneFrom}
				/>
			)}
		</div>
	);
}

interface ProjectGridProps {
	label?: string;
	projects: ProjectCardInfo[];
	onToggleFavorite: (project: ProjectCardInfo) => void;
	onClone: (project: ProjectCardInfo) => void;
}

function ProjectGrid({
	label,
	projects,
	onToggleFavorite,
	onClone,
}: ProjectGridProps) {
	if (projects.length === 0) return null;
	return (
		<div>
			{label && (
				<h2 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
					{label}
				</h2>
			)}
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{projects.map((project) => (
					<ProjectCard
						key={project.id}
						onClone={() => onClone(project)}
						onToggleFavorite={() => onToggleFavorite(project)}
						project={project}
					/>
				))}
			</div>
		</div>
	);
}

function ProjectCard({
	project,
	onToggleFavorite,
	onClone,
}: {
	project: ProjectCardInfo;
	onToggleFavorite: () => void;
	onClone: () => void;
}) {
	return (
		<div className="group relative">
			<Link
				className="block"
				href={`/dashboard/organization/projects/${project.id}`}
			>
				<Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
					<CardHeader className="pb-3">
						<div className="flex items-start justify-between gap-2">
							<div className="flex items-center gap-2">
								<div
									className="h-3 w-3 shrink-0 rounded-full"
									style={{ backgroundColor: project.color }}
								/>
								<CardTitle className="line-clamp-1 text-base">
									{project.name}
								</CardTitle>
							</div>
							<Badge
								className={
									STATUS_COLORS[project.status] ??
									STATUS_COLORS.active
								}
								variant="secondary"
							>
								{project.status}
							</Badge>
						</div>
						{project.description && (
							<CardDescription className="line-clamp-2 text-xs">
								{project.description}
							</CardDescription>
						)}
					</CardHeader>
					<CardContent className="pt-0">
						<div className="flex items-center gap-4 text-muted-foreground text-xs">
							<span className="flex items-center gap-1">
								<UsersIcon className="size-3.5" />
								{project.members.length} member
								{project.members.length !== 1 ? "s" : ""}
							</span>
							{project.endDate && (
								<span className="flex items-center gap-1">
									<CalendarIcon className="size-3.5" />
									{new Date(project.endDate).toLocaleDateString()}
								</span>
							)}
							{project.templateProjectId && (
								<span
									className="flex items-center gap-1"
									title="Cloned from another project"
								>
									<CopyIcon className="size-3.5" />
									Clone
								</span>
							)}
						</div>
					</CardContent>
				</Card>
			</Link>

			{/* Card actions overlay */}
			<div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 data-[open=true]:opacity-100">
				<Button
					className="size-7"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onToggleFavorite();
					}}
					size="icon"
					title={
						project.isFavorite ? "Remove favorite" : "Add to favorites"
					}
					variant="ghost"
				>
					<StarIcon
						className={cn(
							"size-3.5",
							project.isFavorite
								? "fill-yellow-400 text-yellow-400"
								: "text-muted-foreground",
						)}
					/>
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="size-7"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
							size="icon"
							variant="ghost"
						>
							<MoreHorizontalIcon className="size-3.5" />
							<span className="sr-only">Project actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						onClick={(e) => e.stopPropagation()}
					>
						<DropdownMenuItem
							onSelect={(e) => {
								e.preventDefault();
								onClone();
							}}
						>
							<CopyIcon className="mr-2 size-3.5" />
							Clone project
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
