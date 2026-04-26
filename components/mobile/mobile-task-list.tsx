"use client";

import { format, isPast, isToday } from "date-fns";
import {
	AlertCircleIcon,
	ArrowUpIcon,
	CheckCircle2Icon,
	ChevronRightIcon,
	FolderIcon,
	LayersIcon,
	Loader2Icon,
	MinusIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

const PRIORITY_ICONS: Record<
	string,
	{ icon: React.ComponentType<{ className?: string }>; color: string }
> = {
	urgent: { icon: AlertCircleIcon, color: "text-red-500" },
	high: { icon: ArrowUpIcon, color: "text-orange-500" },
	medium: { icon: MinusIcon, color: "text-yellow-500" },
	low: { icon: MinusIcon, color: "text-blue-400" },
	none: { icon: MinusIcon, color: "text-muted-foreground" },
};

type MobileTask = {
	id: string;
	title: string;
	priority: string;
	dueDate: Date | null;
	completedAt: Date | null;
	templateTaskId: string | null;
	status: { type: string; color: string; name: string } | null;
	project: { id: string; name: string; color: string };
};

type Filter = "todo" | "done";
type GroupBy = "project" | "template";

export function MobileTaskList(): React.JSX.Element {
	const [activeFilter, setActiveFilter] = React.useState<Filter>("todo");
	const [groupBy, setGroupBy] = React.useState<GroupBy>("project");

	const { data: tasks, isLoading } =
		trpc.organization.task.listForOrg.useQuery({
			onlyMine: true,
			includeCompleted: activeFilter === "done",
		});

	const typed = React.useMemo<MobileTask[]>(() => {
		if (!tasks) return [];
		return tasks.map((t) => ({
			id: t.id,
			title: t.title,
			priority: t.priority,
			dueDate: t.dueDate ?? null,
			completedAt: t.completedAt ?? null,
			templateTaskId: t.templateTaskId ?? null,
			status: t.status
				? { type: t.status.type, color: t.status.color, name: t.status.name }
				: null,
			project: {
				id: t.project.id,
				name: t.project.name,
				color: t.project.color,
			},
		}));
	}, [tasks]);

	const filtered = React.useMemo<MobileTask[]>(() => {
		if (activeFilter === "done") {
			return typed.filter((t) => t.completedAt !== null);
		}
		return typed.filter((t) => t.completedAt === null);
	}, [typed, activeFilter]);

	const groups = React.useMemo(() => groupTasks(filtered, groupBy), [
		filtered,
		groupBy,
	]);

	return (
		<div className="flex h-full flex-col">
			<div className="border-b bg-background px-4 pt-4 pb-3">
				<h1 className="mb-3 font-bold text-xl">My Tasks</h1>

				{/* Active / Completed tabs */}
				<div className="mb-2 flex rounded-lg bg-muted p-1">
					<button
						className={cn(
							"flex-1 rounded-md py-1.5 font-medium text-sm transition-colors",
							activeFilter === "todo"
								? "bg-background shadow-sm"
								: "text-muted-foreground",
						)}
						onClick={() => setActiveFilter("todo")}
						type="button"
					>
						Active
					</button>
					<button
						className={cn(
							"flex-1 rounded-md py-1.5 font-medium text-sm transition-colors",
							activeFilter === "done"
								? "bg-background shadow-sm"
								: "text-muted-foreground",
						)}
						onClick={() => setActiveFilter("done")}
						type="button"
					>
						Completed
					</button>
				</div>

				{/* Group by toggle */}
				<div className="flex gap-2">
					<button
						className={cn(
							"flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
							groupBy === "project"
								? "border-primary bg-primary/10 text-primary"
								: "text-muted-foreground",
						)}
						onClick={() => setGroupBy("project")}
						type="button"
					>
						<FolderIcon className="size-3" />
						By project
					</button>
					<button
						className={cn(
							"flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
							groupBy === "template"
								? "border-primary bg-primary/10 text-primary"
								: "text-muted-foreground",
						)}
						onClick={() => setGroupBy("template")}
						type="button"
					>
						<LayersIcon className="size-3" />
						By template
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{isLoading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<FolderIcon className="mb-3 size-10 text-muted-foreground/30" />
						<p className="font-medium text-muted-foreground">
							{activeFilter === "done"
								? "No completed tasks"
								: "You're all caught up"}
						</p>
					</div>
				) : (
					groups.map((g) => (
						<GroupSection group={g} key={g.key} />
					))
				)}
			</div>
		</div>
	);
}

interface MobileGroup {
	key: string;
	label: string;
	color?: string;
	subtitle?: string;
	tasks: MobileTask[];
}

function groupTasks(tasks: MobileTask[], groupBy: GroupBy): MobileGroup[] {
	if (tasks.length === 0) return [];

	if (groupBy === "project") {
		const byProject = new Map<string, MobileGroup>();
		for (const t of tasks) {
			let group = byProject.get(t.project.id);
			if (!group) {
				group = {
					key: t.project.id,
					label: t.project.name,
					color: t.project.color,
					tasks: [],
				};
				byProject.set(t.project.id, group);
			}
			group.tasks.push(t);
		}
		return Array.from(byProject.values()).sort((a, b) =>
			a.label.localeCompare(b.label),
		);
	}

	// Group by template
	const byTemplate = new Map<string, MobileGroup>();
	for (const t of tasks) {
		const key = t.templateTaskId ?? `title:${t.title.toLowerCase()}`;
		let group = byTemplate.get(key);
		if (!group) {
			group = { key, label: t.title, tasks: [] };
			byTemplate.set(key, group);
		}
		group.tasks.push(t);
	}
	return Array.from(byTemplate.values())
		.map((g) => ({
			...g,
			subtitle:
				g.tasks.length > 1 ? `${g.tasks.length} projects` : undefined,
		}))
		.sort((a, b) => b.tasks.length - a.tasks.length);
}

function GroupSection({ group }: { group: MobileGroup }) {
	return (
		<div className="mt-4">
			<div className="flex items-center gap-2 px-4 pb-2">
				{group.color && (
					<span
						className="h-2.5 w-2.5 rounded-full"
						style={{ backgroundColor: group.color }}
					/>
				)}
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					{group.label}
				</span>
				<span className="text-muted-foreground text-xs">
					({group.subtitle ?? group.tasks.length})
				</span>
			</div>

			<div className="divide-y">
				{group.tasks.map((task) => (
					<TaskLink key={task.id} task={task} />
				))}
			</div>
		</div>
	);
}

function TaskLink({ task }: { task: MobileTask }) {
	const priority = PRIORITY_ICONS[task.priority] ?? PRIORITY_ICONS.none!;
	const PriorityIcon = priority?.icon ?? MinusIcon;
	const isDone = task.status?.type === "done" || task.completedAt !== null;
	const isOverdue =
		!isDone &&
		task.dueDate != null &&
		isPast(task.dueDate) &&
		!isToday(task.dueDate);

	return (
		<Link
			className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/50"
			href={`/mobile/my-tasks/${task.id}`}
		>
			<PriorityIcon className={cn("size-4 shrink-0", priority?.color)} />

			<div className="flex-1 overflow-hidden">
				<p
					className={cn(
						"truncate font-medium text-sm",
						isDone && "line-through text-muted-foreground",
					)}
				>
					{task.title}
				</p>
				<p className="flex items-center gap-2 text-xs">
					<span
						className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
					>
						<span
							className="h-1.5 w-1.5 rounded-full"
							style={{ backgroundColor: task.project.color }}
						/>
						<span className="max-w-40 truncate">
							{task.project.name}
						</span>
					</span>
					{task.dueDate && (
						<span
							className={cn(
								isOverdue ? "text-red-500" : "text-muted-foreground",
							)}
						>
							Due {format(task.dueDate, "MMM d")}
						</span>
					)}
				</p>
			</div>

			{isDone ? (
				<CheckCircle2Icon className="size-5 shrink-0 text-green-500" />
			) : (
				<div className="flex items-center gap-2">
					{task.status && (
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: task.status.color }}
						/>
					)}
					<ChevronRightIcon className="size-4 text-muted-foreground" />
				</div>
			)}
		</Link>
	);
}
