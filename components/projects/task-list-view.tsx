"use client";

import {
	CheckCircle2Icon,
	ChevronDownIcon,
	ChevronRightIcon,
	CircleIcon,
	FilterIcon,
	Loader2Icon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { AssigneePicker } from "@/components/projects/pickers/assignee-picker";
import { DatePicker } from "@/components/projects/pickers/date-picker";
import {
	PRIORITY_META,
	PriorityPicker,
	type TaskPriorityValue,
} from "@/components/projects/pickers/priority-picker";
import {
	STATUS_TYPE_ICON,
	StatusPicker,
} from "@/components/projects/pickers/status-picker";
import { TaskDetailPanel } from "@/components/projects/task-detail-panel";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TaskStatusType } from "@/lib/db/schema/enums";
import { trpc } from "@/trpc/client";

interface TaskItem {
	id: string;
	title: string;
	priority: TaskPriorityValue;
	statusId: string | null;
	dueDate: Date | null;
	assigneeId: string | null;
	status: { type: string; color: string; name: string } | null;
	assignee: { id: string; name: string; image: string | null } | null;
	labels: Array<{ labelId: string; label: { name: string; color: string } }>;
	subtasks: Array<{ id: string; title: string; status: { type: string } | null }>;
}

interface TaskFilters {
	statusIds: string[];
	priorities: TaskPriorityValue[];
	assigneeIds: (string | null)[];
}

interface TaskListViewProps {
	projectId: string;
}

export function TaskListView({ projectId }: TaskListViewProps): React.JSX.Element {
	const [createOpen, setCreateOpen] = React.useState(false);
	const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
		null,
	);
	const [filters, setFilters] = React.useState<TaskFilters>({
		statusIds: [],
		priorities: [],
		assigneeIds: [],
	});
	const utils = trpc.useUtils();

	const { data: project } = trpc.organization.project.get.useQuery({
		id: projectId,
	});
	const { data: tasks, isLoading } = trpc.organization.task.list.useQuery({
		projectId,
		parentId: null,
	});

	const listKey = React.useMemo(
		() => ({ projectId, parentId: null as string | null }),
		[projectId],
	);

	const invalidate = React.useCallback(() => {
		utils.organization.task.list.invalidate({ projectId });
		utils.organization.task.listForOrg.invalidate();
	}, [utils, projectId]);

	const projectMembersRef = React.useRef<
		Array<{
			userId: string;
			user: { id: string; name: string; email: string; image: string | null };
		}>
	>([]);
	const projectStatusesRef = React.useRef<
		Array<{ id: string; name: string; color: string; type: TaskStatusType }>
	>([]);
	React.useEffect(() => {
		if (project?.members) {
			projectMembersRef.current = project.members as typeof projectMembersRef.current;
		}
		if (project?.taskStatuses) {
			projectStatusesRef.current = project.taskStatuses as typeof projectStatusesRef.current;
		}
	}, [project?.members, project?.taskStatuses]);

	const updateStatus = trpc.organization.task.updateStatus.useMutation({
		onMutate: async (vars) => {
			await utils.organization.task.list.cancel(listKey);
			const previous = utils.organization.task.list.getData(listKey);
			utils.organization.task.list.setData(listKey, (old) => {
				if (!old) return old;
				return old.map((t) => {
					if (t.id !== vars.id) return t;
					const newStatus =
						projectStatusesRef.current.find((s) => s.id === vars.statusId) ??
						null;
					return {
						...t,
						statusId: vars.statusId ?? null,
						status: newStatus
							? {
									...(t.status ?? ({} as NonNullable<typeof t.status>)),
									id: newStatus.id,
									name: newStatus.name,
									color: newStatus.color,
									type: newStatus.type,
								}
							: null,
					};
				});
			});
			return { previous };
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous) utils.organization.task.list.setData(listKey, ctx.previous);
			toast.error(err.message);
		},
		onSettled: invalidate,
	});

	const updateTask = trpc.organization.task.update.useMutation({
		onMutate: async (vars) => {
			await utils.organization.task.list.cancel(listKey);
			const previous = utils.organization.task.list.getData(listKey);
			utils.organization.task.list.setData(listKey, (old) => {
				if (!old) return old;
				return old.map((t) => {
					if (t.id !== vars.id) return t;
					const patched = { ...t };
					if (vars.title !== undefined) patched.title = vars.title;
					if (vars.priority !== undefined)
						patched.priority = vars.priority as typeof t.priority;
					if (vars.dueDate !== undefined) patched.dueDate = vars.dueDate ?? null;
					if (vars.startDate !== undefined)
						patched.startDate = vars.startDate ?? null;
					if (vars.assigneeId !== undefined) {
						patched.assigneeId = vars.assigneeId ?? null;
						if (vars.assigneeId === null) {
							patched.assignee = null;
						} else {
							const m = projectMembersRef.current.find(
								(pm) => pm.userId === vars.assigneeId,
							);
							patched.assignee = m
								? ({ ...m.user } as typeof t.assignee)
								: t.assignee;
						}
					}
					return patched;
				});
			});
			return { previous };
		},
		onError: (err, _vars, ctx) => {
			if (ctx?.previous) utils.organization.task.list.setData(listKey, ctx.previous);
			toast.error(err.message);
		},
		onSettled: invalidate,
	});

	const doneStatus = project?.taskStatuses.find((s) => s.type === "done");

	const projectMemberCandidates = React.useMemo(
		() =>
			project?.members.map((m) => ({
				userId: m.userId,
				name: m.user.name,
				email: m.user.email,
				image: m.user.image,
			})) ?? undefined,
		[project?.members],
	);

	const handleStatusToggle = (taskId: string, _currentStatusId: string | null) => {
		const task = tasks?.find((t) => t.id === taskId);
		if (!task) return;

		if (task.status?.type === "done") {
			const todoStatus = project?.taskStatuses.find((s) => s.type === "todo");
			updateStatus.mutate({ id: taskId, statusId: todoStatus?.id ?? null });
		} else {
			updateStatus.mutate({ id: taskId, statusId: doneStatus?.id ?? null });
		}
	};

	const applyFilters = (rows: TaskItem[]): TaskItem[] => {
		return rows.filter((t) => {
			if (
				filters.statusIds.length > 0 &&
				(!t.statusId || !filters.statusIds.includes(t.statusId))
			) {
				return false;
			}
			if (
				filters.priorities.length > 0 &&
				!filters.priorities.includes(t.priority)
			) {
				return false;
			}
			if (filters.assigneeIds.length > 0) {
				const assigneeKey: string | null = t.assigneeId;
				const match = filters.assigneeIds.some((id) =>
					id === null ? assigneeKey === null : assigneeKey === id,
				);
				if (!match) return false;
			}
			return true;
		});
	};

	// Group tasks by status
	const tasksByStatus = React.useMemo(() => {
		if (!tasks || !project) return [];

		const toTaskItem = (t: NonNullable<typeof tasks>[number]): TaskItem => ({
			id: t.id,
			title: t.title,
			priority: t.priority as TaskPriorityValue,
			statusId: t.statusId ?? null,
			dueDate: t.dueDate ?? null,
			assigneeId: t.assigneeId ?? null,
			status: t.status
				? { type: t.status.type, color: t.status.color, name: t.status.name }
				: null,
			assignee: t.assignee
				? {
						id: t.assignee.id,
						name: t.assignee.name,
						image: t.assignee.image ?? null,
					}
				: null,
			labels: t.labels.map((tl) => ({
				labelId: tl.labelId,
				label: { name: tl.label.name, color: tl.label.color },
			})),
			subtasks: (t.subtasks ?? []).map((s) => ({
				id: s.id,
				title: s.title,
				status: s.status ? { type: s.status.type } : null,
			})),
		});

		const grouped = project.taskStatuses.map((status) => ({
			status,
			tasks: applyFilters(
				tasks.filter((t) => t.statusId === status.id).map(toTaskItem),
			),
		}));

		const ungrouped = applyFilters(
			tasks
				.filter((t) => !project.taskStatuses.find((s) => s.id === t.statusId))
				.map(toTaskItem),
		);

		if (ungrouped.length > 0) {
			grouped.unshift({
				status: {
					id: "__none__",
					name: "No Status",
					color: "#94a3b8",
					type: "todo" as TaskStatusType,
					order: -1,
					projectId,
					createdAt: new Date(),
				},
				tasks: ungrouped,
			});
		}

		return grouped.filter(
			(g) => g.tasks.length > 0 || g.status.type !== "cancelled",
		);
	}, [tasks, project, projectId, filters]);

	const filterCount =
		filters.statusIds.length +
		filters.priorities.length +
		filters.assigneeIds.length;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex items-center gap-2 border-b px-4 py-2">
				<Button
					onClick={() => setCreateOpen(true)}
					size="sm"
					variant="outline"
				>
					<PlusIcon className="mr-1 size-3.5" />
					Add Task
				</Button>
				<FilterPopover
					filters={filters}
					onChange={setFilters}
					statuses={project?.taskStatuses ?? []}
					members={projectMemberCandidates ?? []}
					count={filterCount}
				/>
				{filterCount > 0 && (
					<Button
						size="sm"
						variant="ghost"
						onClick={() =>
							setFilters({ statusIds: [], priorities: [], assigneeIds: [] })
						}
					>
						<XIcon className="mr-1 size-3.5" />
						Clear
					</Button>
				)}
			</div>

			{/* Task list */}
			<div className="flex-1 overflow-auto">
				{tasksByStatus.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<CheckCircle2Icon className="mb-3 size-10 text-muted-foreground/30" />
						<p className="font-medium text-muted-foreground">
							{filterCount > 0 ? "No tasks match your filters" : "No tasks yet"}
						</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{filterCount > 0
								? "Try clearing some filters."
								: "Create your first task to get started"}
						</p>
						{filterCount === 0 && (
							<Button
								className="mt-4"
								onClick={() => setCreateOpen(true)}
								size="sm"
							>
								<PlusIcon className="mr-1 size-3.5" />
								Add Task
							</Button>
						)}
					</div>
				) : (
					tasksByStatus.map(({ status, tasks: groupTasks }) => (
						<StatusGroup
							key={status.id}
							onOpenTask={setSelectedTaskId}
							onStatusToggle={handleStatusToggle}
							onUpdateTask={(taskId, patch) =>
								updateTask.mutate({ id: taskId, ...patch })
							}
							onUpdateStatus={(taskId, statusId) =>
								updateStatus.mutate({ id: taskId, statusId })
							}
							memberCandidates={projectMemberCandidates}
							statusOptions={project?.taskStatuses ?? []}
							status={status}
							tasks={groupTasks}
						/>
					))
				)}
			</div>

			<CreateTaskDialog
				onOpenChange={setCreateOpen}
				open={createOpen}
				projectId={projectId}
				statuses={project?.taskStatuses ?? []}
			/>

			{selectedTaskId && (
				<TaskDetailPanel
					onClose={() => setSelectedTaskId(null)}
					taskId={selectedTaskId}
				/>
			)}
		</div>
	);
}

// ─── Filter popover ──────────────────────────────────────────────────────────

interface FilterPopoverProps {
	filters: TaskFilters;
	onChange: (next: TaskFilters) => void;
	statuses: Array<{ id: string; name: string; color: string; type: string }>;
	members: Array<{ userId: string; name: string; image: string | null }>;
	count: number;
}

function FilterPopover({
	filters,
	onChange,
	statuses,
	members,
	count,
}: FilterPopoverProps) {
	const priorities: TaskPriorityValue[] = [
		"urgent",
		"high",
		"medium",
		"low",
		"none",
	];

	const toggle = <T,>(arr: T[], v: T): T[] =>
		arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button size="sm" variant="ghost">
					<FilterIcon className="mr-1 size-3.5" />
					Filter
					{count > 0 && (
						<span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
							{count}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72">
				<div className="space-y-3">
					<div>
						<p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
							Status
						</p>
						<div className="flex flex-wrap gap-1.5">
							{statuses.map((s) => {
								const active = filters.statusIds.includes(s.id);
								return (
									<button
										key={s.id}
										type="button"
										onClick={() =>
											onChange({
												...filters,
												statusIds: toggle(filters.statusIds, s.id),
											})
										}
										className={cn(
											"flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
											active
												? "border-primary bg-primary/10"
												: "hover:bg-muted/60",
										)}
									>
										<span
											className="h-2 w-2 rounded-full"
											style={{ backgroundColor: s.color }}
										/>
										{s.name}
									</button>
								);
							})}
						</div>
					</div>
					<div>
						<p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
							Priority
						</p>
						<div className="flex flex-wrap gap-1.5">
							{priorities.map((p) => {
								const active = filters.priorities.includes(p);
								const Icon = PRIORITY_META[p].icon;
								return (
									<button
										key={p}
										type="button"
										onClick={() =>
											onChange({
												...filters,
												priorities: toggle(filters.priorities, p),
											})
										}
										className={cn(
											"flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs capitalize transition-colors",
											active
												? "border-primary bg-primary/10"
												: "hover:bg-muted/60",
										)}
									>
										<Icon className={cn("size-3", PRIORITY_META[p].color)} />
										{p}
									</button>
								);
							})}
						</div>
					</div>
					<div>
						<p className="mb-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
							Assignee
						</p>
						<div className="flex flex-wrap gap-1.5">
							<button
								type="button"
								onClick={() =>
									onChange({
										...filters,
										assigneeIds: toggle(filters.assigneeIds, null),
									})
								}
								className={cn(
									"rounded-full border px-2 py-0.5 text-xs transition-colors",
									filters.assigneeIds.includes(null)
										? "border-primary bg-primary/10"
										: "hover:bg-muted/60",
								)}
							>
								Unassigned
							</button>
							{members.map((m) => {
								const active = filters.assigneeIds.includes(m.userId);
								return (
									<button
										key={m.userId}
										type="button"
										onClick={() =>
											onChange({
												...filters,
												assigneeIds: toggle(filters.assigneeIds, m.userId),
											})
										}
										className={cn(
											"rounded-full border px-2 py-0.5 text-xs transition-colors",
											active
												? "border-primary bg-primary/10"
												: "hover:bg-muted/60",
										)}
									>
										{m.name}
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ─── Status group ────────────────────────────────────────────────────────────

interface StatusGroupProps {
	status: {
		id: string;
		name: string;
		color: string;
		type: string;
	};
	tasks: TaskItem[];
	onOpenTask: (taskId: string) => void;
	onStatusToggle: (taskId: string, statusId: string | null) => void;
	onUpdateTask: (
		taskId: string,
		patch: {
			priority?: TaskPriorityValue;
			assigneeId?: string | null;
			dueDate?: Date | null;
		},
	) => void;
	onUpdateStatus: (taskId: string, statusId: string | null) => void;
	memberCandidates: Array<{
		userId: string;
		name: string;
		email?: string | null;
		image: string | null;
	}> | undefined;
	statusOptions: Array<{
		id: string;
		name: string;
		color: string;
		type: string;
	}>;
}

function StatusGroup({
	status,
	tasks,
	onOpenTask,
	onStatusToggle,
	onUpdateTask,
	onUpdateStatus,
	memberCandidates,
	statusOptions,
}: StatusGroupProps) {
	const [collapsed, setCollapsed] = React.useState(false);

	return (
		<div>
			<button
				className="flex w-full items-center gap-2 px-4 py-2 text-left font-medium text-muted-foreground text-sm hover:text-foreground"
				onClick={() => setCollapsed(!collapsed)}
				type="button"
			>
				{collapsed ? (
					<ChevronRightIcon className="size-3.5" />
				) : (
					<ChevronDownIcon className="size-3.5" />
				)}
				<span
					className="h-2 w-2 rounded-full"
					style={{ backgroundColor: status.color }}
				/>
				<span>{status.name}</span>
				<span className="ml-1 text-xs opacity-60">{tasks.length}</span>
			</button>

			{!collapsed &&
				tasks.map((task) => (
					<TaskRow
						key={task.id}
						onOpenTask={onOpenTask}
						onStatusToggle={onStatusToggle}
						onUpdateTask={onUpdateTask}
						onUpdateStatus={onUpdateStatus}
						memberCandidates={memberCandidates}
						statusOptions={statusOptions}
						task={task}
					/>
				))}
		</div>
	);
}

// ─── Task row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
	task: TaskItem;
	onOpenTask: (taskId: string) => void;
	onStatusToggle: (taskId: string, statusId: string | null) => void;
	onUpdateTask: (
		taskId: string,
		patch: {
			priority?: TaskPriorityValue;
			assigneeId?: string | null;
			dueDate?: Date | null;
		},
	) => void;
	onUpdateStatus: (taskId: string, statusId: string | null) => void;
	memberCandidates: Array<{
		userId: string;
		name: string;
		email?: string | null;
		image: string | null;
	}> | undefined;
	statusOptions: Array<{
		id: string;
		name: string;
		color: string;
		type: string;
	}>;
}

function TaskRow({
	task,
	onOpenTask,
	onStatusToggle,
	onUpdateTask,
	onUpdateStatus,
	memberCandidates,
	statusOptions,
}: TaskRowProps) {
	const [expanded, setExpanded] = React.useState(false);
	const StatusIcon = STATUS_TYPE_ICON[task.status?.type ?? "todo"] ?? CircleIcon;
	const isDone = task.status?.type === "done";

	// Stop the row click handler from firing when users interact with an inline
	// property picker. We also prevent opening the task detail when the click
	// lands on an element that has data-stop-open set.
	const openIfNotStop = (e: React.MouseEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement;
		if (target.closest("[data-stop-open]")) return;
		onOpenTask(task.id);
	};

	const onKeyOpen = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		const target = e.target as HTMLElement;
		if (target.closest("[data-stop-open]")) return;
		e.preventDefault();
		onOpenTask(task.id);
	};

	return (
		<>
			<div
				className={cn(
					"group flex cursor-pointer items-center gap-2 border-b px-4 py-1.5 transition-colors hover:bg-muted/30",
					isDone && "opacity-60",
				)}
				onClick={openIfNotStop}
				onKeyDown={onKeyOpen}
				role="button"
				tabIndex={0}
			>
				{/* Expand subtasks */}
				{task.subtasks && task.subtasks.length > 0 ? (
					<button
						className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
						data-stop-open=""
						onClick={(e) => {
							e.stopPropagation();
							setExpanded(!expanded);
						}}
						type="button"
					>
						{expanded ? (
							<ChevronDownIcon className="size-3.5" />
						) : (
							<ChevronRightIcon className="size-3.5" />
						)}
					</button>
				) : (
					<div className="size-5 shrink-0" />
				)}

				{/* Status toggle */}
				<button
					className="shrink-0"
					data-stop-open=""
					onClick={(e) => {
						e.stopPropagation();
						onStatusToggle(task.id, task.statusId ?? null);
					}}
					title="Toggle done"
					type="button"
				>
					<StatusIcon
						className={cn(
							"size-4",
							isDone ? "text-green-500" : "text-muted-foreground",
						)}
					/>
				</button>

				{/* Inline status pill */}
				<div data-stop-open="">
					<StatusPicker
						value={task.statusId ?? null}
						onChange={(statusId) => onUpdateStatus(task.id, statusId)}
						options={statusOptions}
						compact
						className="border-0 px-1.5 py-0.5"
					/>
				</div>

				{/* Inline priority pill */}
				<div data-stop-open="">
					<PriorityPicker
						value={task.priority}
						onChange={(p) => onUpdateTask(task.id, { priority: p })}
						compact
						className="border-0"
					/>
				</div>

				{/* Title */}
				<span
					className={cn(
						"flex-1 truncate text-sm",
						isDone && "text-muted-foreground line-through",
					)}
				>
					{task.title}
				</span>

				{/* Labels */}
				<div className="hidden items-center gap-1 sm:flex">
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

				{/* Inline due-date */}
				<div data-stop-open="" className="hidden sm:block">
					<DatePicker
						value={task.dueDate}
						onChange={(d) => onUpdateTask(task.id, { dueDate: d })}
						placeholder="Due"
						highlightOverdue
						format="MMM d"
						className="border-0 px-1.5"
					/>
				</div>

				{/* Inline assignee */}
				<div data-stop-open="">
					<AssigneePicker
						value={task.assigneeId}
						onChange={(userId) =>
							onUpdateTask(task.id, { assigneeId: userId })
						}
						candidates={memberCandidates}
						currentUser={
							task.assignee
								? {
										userId: task.assignee.id,
										name: task.assignee.name,
										image: task.assignee.image,
									}
								: null
						}
						compact
					/>
				</div>
			</div>

			{/* Subtasks */}
			{expanded &&
				task.subtasks.map((subtask) => (
					<button
						className="flex w-full cursor-pointer items-center gap-2 border-b bg-muted/10 py-1.5 pr-4 pl-10 text-left text-sm transition-colors hover:bg-muted/30"
						key={subtask.id}
						onClick={() => onOpenTask(subtask.id)}
						type="button"
					>
						<StatusIcon className="size-3.5 text-muted-foreground" />
						<span className="flex-1 truncate text-muted-foreground">
							{subtask.title}
						</span>
					</button>
				))}
		</>
	);
}
