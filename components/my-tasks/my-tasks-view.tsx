"use client";

import { format, isPast, isToday, startOfDay } from "date-fns";
import {
	AlertCircleIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	CheckCircle2Icon,
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CircleDashedIcon,
	CircleIcon,
	FolderIcon,
	LayersIcon,
	Loader2Icon,
	MinusIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { QuickAddTask } from "@/components/projects/quick-add-task";
import { TaskDetailPanel } from "@/components/projects/task-detail-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

// ─── Shared icon / color maps ────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
	string,
	{
		icon: React.ComponentType<{ className?: string }>;
		label: string;
		color: string;
	}
> = {
	urgent: { icon: AlertCircleIcon, label: "Urgent", color: "text-red-500" },
	high: { icon: ArrowUpIcon, label: "High", color: "text-orange-500" },
	medium: { icon: MinusIcon, label: "Medium", color: "text-yellow-500" },
	low: { icon: ArrowDownIcon, label: "Low", color: "text-blue-400" },
	none: { icon: MinusIcon, label: "None", color: "text-muted-foreground" },
};

const STATUS_TYPE_ICONS: Record<
	string,
	React.ComponentType<{ className?: string }>
> = {
	todo: CircleIcon,
	in_progress: CircleDashedIcon,
	done: CheckCircle2Icon,
	cancelled: XCircleIcon,
};

// ─── Types ───────────────────────────────────────────────────────────────────

type MyTask = {
	id: string;
	title: string;
	priority: string;
	statusId: string | null;
	dueDate: Date | null;
	completedAt: Date | null;
	templateTaskId: string | null;
	status: { type: string; color: string; name: string } | null;
	assignee: { name: string; image: string | null } | null;
	project: {
		id: string;
		name: string;
		color: string;
		templateProjectId: string | null;
	};
	labels: Array<{ labelId: string; label: { name: string; color: string } }>;
};

type TabId = "today" | "upcoming" | "all" | "completed";
type GroupBy = "project" | "template" | "dueDate";

// ─── Main component ──────────────────────────────────────────────────────────

export function MyTasksView(): React.JSX.Element {
	const [tab, setTab] = React.useState<TabId>("today");
	const [groupBy, setGroupBy] = React.useState<GroupBy>("dueDate");
	const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
		null,
	);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
		() => new Set<string>(),
	);

	const utils = trpc.useUtils();

	const includeCompleted = tab === "completed";
	const { data: tasks, isLoading } = trpc.organization.task.listForOrg.useQuery(
		{
			onlyMine: true,
			includeCompleted,
		},
	);
	const { data: projects } = trpc.organization.project.list.useQuery();

	const bulkComplete = trpc.organization.task.bulkComplete.useMutation({
		onSuccess: (res) => {
			toast.success(
				`Completed ${res.completed} task${res.completed === 1 ? "" : "s"}`,
			);
			setSelectedIds(new Set());
			utils.organization.task.listForOrg.invalidate();
		},
		onError: (err) => toast.error(err.message),
	});

	// ─── Filter tasks by tab ────────────────────────────────────────────────
	const filteredTasks = React.useMemo<MyTask[]>(() => {
		if (!tasks) return [];
		const now = new Date();
		const today = startOfDay(now);

		const typed: MyTask[] = tasks.map((t) => ({
			id: t.id,
			title: t.title,
			priority: t.priority,
			statusId: t.statusId ?? null,
			dueDate: t.dueDate ?? null,
			completedAt: t.completedAt ?? null,
			templateTaskId: t.templateTaskId ?? null,
			status: t.status
				? { type: t.status.type, color: t.status.color, name: t.status.name }
				: null,
			assignee: t.assignee
				? { name: t.assignee.name, image: t.assignee.image ?? null }
				: null,
			project: {
				id: t.project.id,
				name: t.project.name,
				color: t.project.color,
				templateProjectId: t.project.templateProjectId ?? null,
			},
			labels: t.labels.map((tl) => ({
				labelId: tl.labelId,
				label: { name: tl.label.name, color: tl.label.color },
			})),
		}));

		const isOpen = (t: MyTask) =>
			!t.completedAt &&
			t.status?.type !== "done" &&
			t.status?.type !== "cancelled";

		switch (tab) {
			case "today":
				return typed.filter(
					(t) =>
						isOpen(t) &&
						t.dueDate &&
						(isToday(t.dueDate) ||
							(isPast(t.dueDate) && t.dueDate >= new Date(0))),
				);
			case "upcoming":
				return typed.filter((t) => isOpen(t) && t.dueDate && t.dueDate > today);
			case "completed":
				return typed.filter((t) => t.completedAt !== null);
			default:
				return typed.filter(isOpen);
		}
	}, [tasks, tab]);

	// ─── Group tasks ────────────────────────────────────────────────────────
	const groups = React.useMemo(
		() => groupTasks(filteredTasks, groupBy),
		[filteredTasks, groupBy],
	);

	const openIds = React.useMemo(
		() => new Set(filteredTasks.filter((t) => !t.completedAt).map((t) => t.id)),
		[filteredTasks],
	);
	const selectedOpenCount = React.useMemo(
		() => Array.from(selectedIds).filter((id) => openIds.has(id)).length,
		[selectedIds, openIds],
	);
	const projectOptions = React.useMemo(
		() =>
			(projects ?? []).map((project) => ({
				id: project.id,
				name: project.name,
				color: project.color,
			})),
		[projects],
	);

	const handleBulkComplete = () => {
		const ids = Array.from(selectedIds).filter((id) => openIds.has(id));
		if (ids.length === 0) return;
		bulkComplete.mutate({ ids });
	};

	const toggleSelect = (taskId: string, selected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (selected) {
				next.add(taskId);
			} else {
				next.delete(taskId);
			}
			return next;
		});
	};

	const selectGroup = (ids: string[], allSelected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			for (const id of ids) {
				if (allSelected) next.delete(id);
				else next.add(id);
			}
			return next;
		});
	};

	// ─── Render ─────────────────────────────────────────────────────────────

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<div className="flex flex-col gap-0.5">
					<h1 className="font-semibold text-xl tracking-tight">My Tasks</h1>
					<p className="text-muted-foreground text-sm">
						Everything assigned to you across projects
					</p>
				</div>
				<div className="flex items-center gap-2">
					<GroupByPicker groupBy={groupBy} onChange={setGroupBy} />
				</div>
			</div>

			{/* Tabs */}
			<div className="flex items-center gap-1 border-b px-4 sm:px-6">
				{(
					[
						{ id: "today" as const, label: "Today" },
						{ id: "upcoming" as const, label: "Upcoming" },
						{ id: "all" as const, label: "All open" },
						{ id: "completed" as const, label: "Completed" },
					] satisfies Array<{ id: TabId; label: string }>
				).map(({ id, label }) => {
					const isActive = tab === id;
					return (
						<button
							className={cn(
								"border-b-2 px-3 py-2.5 text-sm transition-colors",
								isActive
									? "border-primary text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
							key={id}
							onClick={() => {
								setTab(id);
								setSelectedIds(new Set());
							}}
							type="button"
						>
							{label}
						</button>
					);
				})}
			</div>

			<div className="border-b bg-muted/10 px-4 py-2 sm:px-6">
				<QuickAddTask
					projectOptions={projectOptions}
					placeholder="Add a task..."
					buttonLabel="Create"
				/>
			</div>

			{/* Bulk action bar */}
			{selectedOpenCount > 0 && (
				<div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2 sm:px-6">
					<span className="text-sm">
						<span className="font-medium">{selectedOpenCount}</span> task
						{selectedOpenCount === 1 ? "" : "s"} selected
					</span>
					<div className="flex items-center gap-2">
						<Button
							onClick={() => setSelectedIds(new Set())}
							size="sm"
							variant="ghost"
						>
							Clear
						</Button>
						<Button
							disabled={bulkComplete.isPending}
							onClick={handleBulkComplete}
							size="sm"
						>
							{bulkComplete.isPending ? (
								<Loader2Icon className="mr-1 size-3.5 animate-spin" />
							) : (
								<CheckIcon className="mr-1 size-3.5" />
							)}
							Complete {selectedOpenCount}
						</Button>
					</div>
				</div>
			)}

			{/* Body */}
			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : filteredTasks.length === 0 ? (
					<EmptyState tab={tab} />
				) : (
					<div>
						{groups.map((group) => (
							<GroupSection
								group={group}
								key={group.key}
								onBulkComplete={(ids) => bulkComplete.mutate({ ids })}
								onSelect={toggleSelect}
								onSelectGroup={selectGroup}
								onSelectTask={setSelectedTaskId}
								selectedIds={selectedIds}
							/>
						))}
					</div>
				)}
			</div>

			{selectedTaskId && (
				<TaskDetailPanel
					onClose={() => setSelectedTaskId(null)}
					taskId={selectedTaskId}
				/>
			)}
		</div>
	);
}

// ─── Group-by selector ───────────────────────────────────────────────────────

interface GroupByPickerProps {
	groupBy: GroupBy;
	onChange: (g: GroupBy) => void;
}

function GroupByPicker({ groupBy, onChange }: GroupByPickerProps) {
	const options: Array<{
		id: GroupBy;
		label: string;
		icon: React.ComponentType<{ className?: string }>;
	}> = [
		{ id: "dueDate", label: "Due", icon: CircleIcon },
		{ id: "project", label: "Project", icon: FolderIcon },
		{ id: "template", label: "Template", icon: LayersIcon },
	];

	return (
		<div className="flex rounded-md border bg-background">
			{options.map((opt) => {
				const isActive = groupBy === opt.id;
				return (
					<button
						className={cn(
							"flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md",
							isActive
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
						key={opt.id}
						onClick={() => onChange(opt.id)}
						type="button"
					>
						<opt.icon className="size-3" />
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}

// ─── Group building ──────────────────────────────────────────────────────────

interface Group {
	key: string;
	label: string;
	subtitle?: string;
	color?: string;
	tasks: MyTask[];
	// When true, the tasks share a common template and the group row can
	// expose a one-click "complete all" / select-all button.
	isBatchable: boolean;
}

function groupTasks(tasks: MyTask[], groupBy: GroupBy): Group[] {
	if (tasks.length === 0) return [];

	if (groupBy === "project") {
		const byProject = new Map<string, Group>();
		for (const t of tasks) {
			const key = t.project.id;
			let group = byProject.get(key);
			if (!group) {
				group = {
					key,
					label: t.project.name,
					color: t.project.color,
					tasks: [],
					isBatchable: false,
				};
				byProject.set(key, group);
			}
			group.tasks.push(t);
		}
		return Array.from(byProject.values()).sort((a, b) =>
			a.label.localeCompare(b.label),
		);
	}

	if (groupBy === "template") {
		// Group by (templateTaskId root OR title) - tasks that originated from
		// the same template task. For rows without a templateTaskId we fall
		// back to grouping by exact title (a reasonable heuristic since
		// workers will typically have the same task title across clones).
		const byTemplate = new Map<string, Group>();
		for (const t of tasks) {
			const key = t.templateTaskId ?? `title:${t.title.toLowerCase()}`;
			let group = byTemplate.get(key);
			if (!group) {
				group = {
					key,
					label: t.title,
					subtitle: "",
					tasks: [],
					isBatchable: false,
				};
				byTemplate.set(key, group);
			}
			group.tasks.push(t);
		}
		// Only mark groups with more than 1 task as batchable, and drop the
		// single-task groups into a flat tail so they don't clutter the UI
		// with one-item sections.
		const result: Group[] = [];
		const singletons: MyTask[] = [];
		for (const group of byTemplate.values()) {
			if (group.tasks.length > 1) {
				group.isBatchable = true;
				group.subtitle = `${group.tasks.length} projects`;
				result.push(group);
			} else {
				singletons.push(...group.tasks);
			}
		}
		result.sort((a, b) => b.tasks.length - a.tasks.length);
		if (singletons.length > 0) {
			result.push({
				key: "__singletons__",
				label: "Other",
				subtitle: `${singletons.length}`,
				tasks: singletons,
				isBatchable: false,
			});
		}
		return result;
	}

	// dueDate buckets: Overdue / Today / This week / Later / No due date
	const now = new Date();
	const today = startOfDay(now);
	const buckets: Record<string, MyTask[]> = {
		overdue: [],
		today: [],
		week: [],
		later: [],
		none: [],
	};

	const weekEnd = new Date(today);
	weekEnd.setDate(today.getDate() + 7);

	for (const t of tasks) {
		if (!t.dueDate) {
			buckets.none!.push(t);
			continue;
		}
		if (t.completedAt) {
			buckets.later!.push(t);
			continue;
		}
		if (isPast(t.dueDate) && !isToday(t.dueDate)) {
			buckets.overdue!.push(t);
		} else if (isToday(t.dueDate)) {
			buckets.today!.push(t);
		} else if (t.dueDate <= weekEnd) {
			buckets.week!.push(t);
		} else {
			buckets.later!.push(t);
		}
	}

	const groups: Group[] = [];
	const mk = (key: string, label: string, ts: MyTask[]): Group => ({
		key,
		label,
		tasks: ts,
		isBatchable: false,
	});
	if (buckets.overdue!.length)
		groups.push(mk("overdue", "Overdue", buckets.overdue!));
	if (buckets.today!.length) groups.push(mk("today", "Today", buckets.today!));
	if (buckets.week!.length) groups.push(mk("week", "This week", buckets.week!));
	if (buckets.later!.length) groups.push(mk("later", "Later", buckets.later!));
	if (buckets.none!.length)
		groups.push(mk("none", "No due date", buckets.none!));
	return groups;
}

// ─── Group section ───────────────────────────────────────────────────────────

interface GroupSectionProps {
	group: Group;
	selectedIds: Set<string>;
	onSelect: (taskId: string, selected: boolean) => void;
	onSelectGroup: (ids: string[], allSelected: boolean) => void;
	onBulkComplete: (ids: string[]) => void;
	onSelectTask: (taskId: string) => void;
}

function GroupSection({
	group,
	selectedIds,
	onSelect,
	onSelectGroup,
	onBulkComplete,
	onSelectTask,
}: GroupSectionProps) {
	const [collapsed, setCollapsed] = React.useState(false);

	const groupOpenIds = group.tasks
		.filter((t) => !t.completedAt)
		.map((t) => t.id);
	const allSelected =
		groupOpenIds.length > 0 && groupOpenIds.every((id) => selectedIds.has(id));

	return (
		<div>
			<div className="flex items-center gap-2 border-b bg-muted/10 px-4 py-1.5 sm:px-6">
				<button
					className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
					onClick={() => setCollapsed(!collapsed)}
					type="button"
				>
					{collapsed ? (
						<ChevronRightIcon className="size-3.5" />
					) : (
						<ChevronDownIcon className="size-3.5" />
					)}
				</button>
				{group.color && (
					<span
						className="h-2 w-2 shrink-0 rounded-full"
						style={{ backgroundColor: group.color }}
					/>
				)}
				<span className="font-medium text-sm">{group.label}</span>
				<span className="text-muted-foreground text-xs">
					{group.subtitle ?? group.tasks.length}
				</span>

				{group.isBatchable && groupOpenIds.length > 0 && (
					<div className="ml-auto flex items-center gap-2">
						<Button
							onClick={() => onSelectGroup(groupOpenIds, allSelected)}
							size="sm"
							variant="ghost"
						>
							{allSelected ? "Deselect all" : "Select all"}
						</Button>
						<Button
							onClick={() => onBulkComplete(groupOpenIds)}
							size="sm"
							variant="outline"
						>
							<CheckIcon className="mr-1 size-3.5" />
							Complete all {groupOpenIds.length}
						</Button>
					</div>
				)}
			</div>

			{!collapsed &&
				group.tasks.map((task) => (
					<TaskRow
						isSelected={selectedIds.has(task.id)}
						key={task.id}
						onSelect={onSelect}
						onSelectTask={onSelectTask}
						task={task}
					/>
				))}
		</div>
	);
}

// ─── Single task row ─────────────────────────────────────────────────────────

interface TaskRowProps {
	task: MyTask;
	isSelected: boolean;
	onSelect: (taskId: string, selected: boolean) => void;
	onSelectTask: (taskId: string) => void;
}

function TaskRow({ task, isSelected, onSelect, onSelectTask }: TaskRowProps) {
	const StatusIcon =
		STATUS_TYPE_ICONS[task.status?.type ?? "todo"] ?? CircleIcon;
	const priorityConfig = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none;
	const PriorityIcon = priorityConfig?.icon ?? MinusIcon;
	const priorityColor = priorityConfig?.color ?? "text-muted-foreground";
	const isDone = task.status?.type === "done" || task.completedAt !== null;
	const isOverdue =
		!isDone &&
		task.dueDate != null &&
		isPast(task.dueDate) &&
		!isToday(task.dueDate);

	return (
		<div
			className={cn(
				"group flex items-center gap-2 border-b px-4 py-2 transition-colors hover:bg-muted/30 sm:px-6",
				isDone && "opacity-60",
			)}
		>
			<div className="shrink-0">
				<Checkbox
					checked={isSelected}
					disabled={isDone}
					onCheckedChange={(checked) => onSelect(task.id, checked === true)}
				/>
			</div>

			<button
				className="flex flex-1 items-center gap-2 overflow-hidden text-left"
				onClick={() => onSelectTask(task.id)}
				type="button"
			>
				<StatusIcon
					className={cn(
						"size-4 shrink-0",
						isDone ? "text-green-500" : "text-muted-foreground",
					)}
				/>

				<PriorityIcon className={cn("size-3.5 shrink-0", priorityColor)} />

				<span
					className={cn(
						"truncate text-sm",
						isDone && "line-through text-muted-foreground",
					)}
				>
					{task.title}
				</span>

				{/* Project chip */}
				<Link
					className="hidden shrink-0 items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-muted-foreground text-xs hover:text-foreground sm:inline-flex"
					href={`/dashboard/organization/projects/${task.project.id}/list`}
					onClick={(e) => e.stopPropagation()}
				>
					<span
						className="h-1.5 w-1.5 rounded-full"
						style={{ backgroundColor: task.project.color }}
					/>
					<span className="max-w-56 truncate">{task.project.name}</span>
				</Link>
			</button>

			{/* Labels */}
			<div className="hidden shrink-0 items-center gap-1 lg:flex">
				{task.labels.slice(0, 2).map((tl) => (
					<span
						className="rounded-full px-1.5 py-0.5 font-medium text-[10px]"
						key={tl.labelId}
						style={{
							backgroundColor: `${tl.label.color}20`,
							color: tl.label.color,
						}}
					>
						{tl.label.name}
					</span>
				))}
			</div>

			{/* Due date */}
			{task.dueDate && (
				<span
					className={cn(
						"hidden shrink-0 text-xs sm:block",
						isOverdue
							? "text-red-500"
							: isToday(task.dueDate)
								? "text-orange-500"
								: "text-muted-foreground",
					)}
				>
					{format(task.dueDate, "MMM d")}
				</span>
			)}

			{/* Assignee */}
			{task.assignee ? (
				<Avatar className="size-5 shrink-0">
					<AvatarImage src={task.assignee.image ?? undefined} />
					<AvatarFallback className="text-[9px]">
						{task.assignee.name.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
			) : (
				<div className="size-5 shrink-0" />
			)}
		</div>
	);
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabId }) {
	const copy: Record<TabId, { title: string; body: string }> = {
		today: {
			title: "Nothing due today",
			body: "You're all caught up. Check Upcoming for what's next.",
		},
		upcoming: {
			title: "No upcoming tasks",
			body: "Add due dates to your tasks to see them here.",
		},
		all: {
			title: "No open tasks",
			body: "You don't have any tasks assigned to you right now.",
		},
		completed: {
			title: "No completed tasks",
			body: "Tasks you finish will appear here.",
		},
	};
	const { title, body } = copy[tab];
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<CheckCircle2Icon className="mb-3 size-10 text-muted-foreground/30" />
			<p className="font-medium">{title}</p>
			<p className="mt-1 max-w-sm text-muted-foreground text-sm">{body}</p>
		</div>
	);
}
