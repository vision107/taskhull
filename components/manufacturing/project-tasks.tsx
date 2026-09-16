"use client";

import NiceModal from "@ebay/nice-modal-react";
import type { inferRouterOutputs } from "@trpc/server";
import { format, isPast, isToday, parseISO } from "date-fns";
import {
	CameraIcon,
	CheckIcon,
	ChevronRightIcon,
	ListChecksIcon,
	ListTreeIcon,
	LockIcon,
	MessageSquareTextIcon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { AssigneePicker } from "@/components/manufacturing/assignee-picker";
import { BuildTaskModal } from "@/components/manufacturing/build-task-modal";
import { QuickAddTask } from "@/components/manufacturing/quick-add-task";
import {
	TaskStatusBadge,
	taskStatusLabels,
} from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user/user-avatar";
import { BuildTaskStatus, BuildTaskStatuses } from "@/lib/db/schema/enums";
import { isNetworkError } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type ProjectTask =
	inferRouterOutputs<AppRouter>["organization"]["build"]["get"]["tasks"][number];

/**
 * Same column model as My tasks, minus Project (we are already in one).
 * Assignees take that slot. Container queries so the peek can steal width.
 *
 *   narrow  → name (two lines) · due
 *   @xl     → name · due · assignees · status
 *   @3xl    → name · due · assignees · progress · status
 */
const gridColumns =
	"grid grid-cols-[minmax(0,1fr)_5.5rem] @xl:grid-cols-[minmax(0,1fr)_7rem_8.5rem_7.5rem] @3xl:grid-cols-[minmax(0,1fr)_7rem_8.5rem_9rem_7.5rem]";

const cellBorder = "@xl:border-l @xl:border-subtle";

function dueLabel(task: ProjectTask): { text: string; overdue: boolean } {
	if (!task.startDate) return { text: "Unscheduled", overdue: false };
	const start = parseISO(task.startDate);
	if (isToday(start)) return { text: "Today", overdue: false };
	const overdue = isPast(start) && task.status !== "done";
	return { text: format(start, "d. MMM"), overdue };
}

export function ProjectTasks({
	buildId,
	canPlan,
	tasks,
	selectedTaskId,
	onOpenTask,
}: {
	buildId: string;
	canPlan: boolean;
	tasks: ProjectTask[];
	selectedTaskId?: string | null;
	onOpenTask?: (taskId: string) => boolean;
}): React.JSX.Element {
	const utils = trpc.useUtils();
	const [collapsedPhases, setCollapsedPhases] = React.useState<Set<string>>(
		() => new Set(),
	);
	const [collapsedParents, setCollapsedParents] = React.useState<Set<string>>(
		() => new Set(),
	);
	const [addingSubtaskFor, setAddingSubtaskFor] = React.useState<string | null>(
		null,
	);

	const invalidate = () => {
		void utils.organization.build.get.invalidate({ id: buildId });
		void utils.organization.build.list.invalidate();
		void utils.organization.work.myTasks.invalidate();
	};

	const createMutation = trpc.organization.build.createTask.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const quickAdd =
		(phase: string | null, parentTaskId?: string) => (title: string) =>
			createMutation.mutateAsync({
				buildId,
				title,
				phase: phase ?? undefined,
				parentTaskId,
			});

	const subtasksByParent = new Map<string, ProjectTask[]>();
	for (const task of tasks) {
		if (!task.parentTaskId) continue;
		const list = subtasksByParent.get(task.parentTaskId) ?? [];
		list.push(task);
		subtasksByParent.set(task.parentTaskId, list);
	}
	const topLevel = tasks.filter((task) => !task.parentTaskId);

	const groups: Array<{ phase: string | null; items: ProjectTask[] }> = [];
	for (const task of topLevel) {
		const last = groups[groups.length - 1];
		if (last && last.phase === (task.phase ?? null)) last.items.push(task);
		else groups.push({ phase: task.phase ?? null, items: [task] });
	}

	const togglePhase = (key: string) =>
		setCollapsedPhases((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	if (tasks.length === 0) {
		return (
			<div className="px-4 py-16 text-center">
				<p className="font-medium">This project has no tasks yet.</p>
				{canPlan && (
					<QuickAddTask
						className="mx-auto mt-4 max-w-md"
						placeholder="Type a task title and press Enter"
						onAdd={quickAdd(null)}
					/>
				)}
			</div>
		);
	}

	return (
		<div className="@container">
			<div
				className={cn(
					gridColumns,
					"sticky top-0 z-10 hidden h-8 items-center border-b border-subtle bg-surface-1 text-xs text-fg-tertiary @xl:grid",
				)}
			>
				<div className="px-3">Name</div>
				<div className={cn(cellBorder, "px-2")}>Due</div>
				<div className={cn(cellBorder, "px-2")}>Assignees</div>
				<div className={cn(cellBorder, "hidden px-2 @3xl:block")}>Progress</div>
				<div className={cn(cellBorder, "px-2")}>Status</div>
			</div>

			{groups.map((group, groupIndex) => {
				const phaseKey = `${group.phase ?? "none"}-${groupIndex}`;
				const isCollapsed = collapsedPhases.has(phaseKey);
				const title = group.phase ?? "No phase";
				return (
					<section key={phaseKey} className="pt-3">
						<div className="flex h-9 items-center gap-1 px-2 sm:px-3">
							<button
								type="button"
								onClick={() => togglePhase(phaseKey)}
								aria-expanded={!isCollapsed}
								aria-label={
									isCollapsed ? `Expand ${title}` : `Collapse ${title}`
								}
								className="flex min-w-0 flex-1 items-center gap-1 text-left hover:bg-layer-transparent-hover"
							>
								<ChevronRightIcon
									className={cn(
										"size-4 text-fg-tertiary transition-transform",
										!isCollapsed && "rotate-90",
									)}
								/>
								<span className="text-sm font-semibold">{title}</span>
								<span className="text-13 text-fg-tertiary tabular-nums">
									{group.items.length}
								</span>
							</button>
							{canPlan && (
								<Button
									variant="ghost"
									size="xs"
									className="text-fg-secondary"
									onClick={() =>
										void NiceModal.show(BuildTaskModal, {
											buildId,
											siblings: tasks.map((task) => ({
												id: task.id,
												title: task.title,
												phase: task.phase,
											})),
											defaultPhase: group.phase,
										})
									}
								>
									<PlusIcon />
									Add task
								</Button>
							)}
						</div>
						{!isCollapsed && (
							<ul className="border-t border-subtle">
								{group.items.map((task) => {
									const subtasks = subtasksByParent.get(task.id) ?? [];
									const parentCollapsed = collapsedParents.has(task.id);
									const showSubtaskAdd =
										canPlan &&
										!parentCollapsed &&
										(subtasks.length > 0 || addingSubtaskFor === task.id);
									return (
										<React.Fragment key={task.id}>
											<TaskRow
												task={task}
												tasks={tasks}
												canPlan={canPlan}
												depth={0}
												hasSubtasks={subtasks.length > 0}
												subtasksCollapsed={parentCollapsed}
												selected={task.id === selectedTaskId}
												onOpen={onOpenTask}
												onToggleSubtasks={() =>
													setCollapsedParents((current) => {
														const next = new Set(current);
														if (next.has(task.id)) next.delete(task.id);
														else next.add(task.id);
														return next;
													})
												}
												onAddSubtask={() => {
													setCollapsedParents((current) => {
														const next = new Set(current);
														next.delete(task.id);
														return next;
													});
													setAddingSubtaskFor(task.id);
												}}
											/>
											{!parentCollapsed &&
												subtasks.map((subtask) => (
													<TaskRow
														key={subtask.id}
														task={subtask}
														tasks={tasks}
														canPlan={canPlan}
														depth={1}
														hasSubtasks={false}
														subtasksCollapsed={false}
														selected={subtask.id === selectedTaskId}
														onOpen={onOpenTask}
													/>
												))}
											{showSubtaskAdd && (
												<li className="border-b border-subtle">
													<QuickAddTask
														className="pl-10"
														placeholder="Add a subtask and press Enter"
														hint={`→ ${task.title}`}
														focusOnMount={addingSubtaskFor === task.id}
														onAdd={quickAdd(task.phase ?? null, task.id)}
													/>
												</li>
											)}
										</React.Fragment>
									);
								})}
								{canPlan && (
									<li>
										<QuickAddTask
											onAdd={quickAdd(group.phase)}
											hint={group.phase ? `→ ${group.phase}` : null}
										/>
									</li>
								)}
							</ul>
						)}
					</section>
				);
			})}
		</div>
	);
}

function TaskRow({
	task,
	tasks,
	canPlan,
	depth,
	hasSubtasks,
	subtasksCollapsed,
	selected,
	onOpen,
	onToggleSubtasks,
	onAddSubtask,
}: {
	task: ProjectTask;
	tasks: ProjectTask[];
	canPlan: boolean;
	depth: 0 | 1;
	hasSubtasks: boolean;
	subtasksCollapsed: boolean;
	selected: boolean;
	onOpen?: (taskId: string) => boolean;
	onToggleSubtasks?: () => void;
	onAddSubtask?: () => void;
}): React.JSX.Element {
	const utils = trpc.useUtils();
	const date = dueLabel(task);
	const status = task.status as BuildTaskStatus;
	const isDone = status === "done";
	const href = `/dashboard/organization/tasks/${task.id}`;
	const owners = task.assignments.filter(
		(assignment) => assignment.role === "owner",
	);
	const blockers = task.dependencies
		.map((dep) => tasks.find((item) => item.id === dep.dependsOnBuildTaskId))
		.filter((item) => item && item.status !== "done");
	const blocked = blockers.length > 0 && !isDone;

	const invalidate = () => {
		void utils.organization.build.get.invalidate();
		void utils.organization.work.getTask.invalidate({ id: task.id });
		void utils.organization.work.myTasks.invalidate();
	};
	const statusMutation = trpc.organization.work.updateStatus.useMutation({
		onSuccess: invalidate,
		onError: (error) => {
			if (!isNetworkError(error)) toast.error(error.message);
		},
	});
	const assignMutation = trpc.organization.build.assign.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const unassignMutation = trpc.organization.build.unassign.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});

	const toggleDone = () => {
		statusMutation.mutate({
			id: task.id,
			status: isDone ? BuildTaskStatus.inProgress : BuildTaskStatus.done,
		});
	};

	const assigneeNames = owners.map((assignment) => assignment.user.name);

	return (
		<li
			className={cn(
				gridColumns,
				"group/row relative min-h-13 items-center border-b border-subtle text-sm transition-colors @xl:min-h-9",
				selected ? "bg-layer-1" : "hover:bg-layer-transparent-hover",
				isDone && "text-fg-secondary",
			)}
		>
			<div
				className={cn(
					"flex min-w-0 items-center gap-1.5 py-1.5 pr-2 pl-2 sm:pl-3 @xl:py-0",
					depth === 1 && "pl-8 sm:pl-9",
				)}
			>
				{depth === 0 && hasSubtasks && (
					<button
						type="button"
						aria-label={subtasksCollapsed ? "Show subtasks" : "Hide subtasks"}
						aria-expanded={!subtasksCollapsed}
						className="relative z-10 -ml-1 rounded p-0.5 text-fg-tertiary hover:text-foreground"
						onClick={onToggleSubtasks}
					>
						<ChevronRightIcon
							className={cn(
								"size-3.5 transition-transform",
								!subtasksCollapsed && "rotate-90",
							)}
						/>
					</button>
				)}
				<button
					type="button"
					aria-label={`Mark "${task.title}" done`}
					aria-pressed={isDone}
					disabled={blocked || statusMutation.isPending}
					onClick={toggleDone}
					className={cn(
						"relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed",
						isDone
							? "border-success bg-success text-white"
							: "border-strong text-transparent hover:border-success hover:text-success disabled:hover:border-strong disabled:hover:text-transparent",
					)}
				>
					<CheckIcon className="size-3" strokeWidth={2.5} />
				</button>
				<div className="min-w-0 flex-1">
					<Link
						href={href}
						aria-label={`Open ${task.title}`}
						onClick={(event) => {
							if (!onOpen || event.metaKey || event.ctrlKey) return;
							if (onOpen(task.id)) event.preventDefault();
						}}
						className={cn(
							"block truncate leading-5 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset",
							isDone && "line-through",
						)}
					>
						{task.title}
					</Link>
					<p className="truncate text-xs text-fg-tertiary @xl:hidden">
						{assigneeNames.length > 0 ? assigneeNames.join(", ") : "Unassigned"}
						{blocked ? " · waiting" : ""}
					</p>
				</div>
				{blocked && <LockIcon className="size-3.5 shrink-0 text-fg-tertiary" />}
				{hasSubtasks && (
					<span
						className="hidden shrink-0 items-center gap-0.5 text-xs text-fg-tertiary tabular-nums @xl:inline-flex"
						title="Subtasks"
					>
						<ListTreeIcon className="size-3.5" />
						{task.subtaskDoneCount}/{task.subtaskTotalCount}
					</span>
				)}
				{canPlan && depth === 0 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Add subtask"
								className="relative z-10 text-fg-tertiary opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
								onClick={onAddSubtask}
							>
								<ListTreeIcon />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Add subtask</TooltipContent>
					</Tooltip>
				)}
				{task.sourceTemplateTaskId === null && (
					<span className="hidden rounded border border-subtle px-1 text-[10px] leading-4 text-fg-tertiary @xl:inline">
						ad-hoc
					</span>
				)}
			</div>

			<div
				className={cn(
					cellBorder,
					"flex h-full items-center justify-end px-2 text-xs whitespace-nowrap tabular-nums @xl:justify-start @xl:text-13",
					date.overdue ? "font-medium text-warning" : "text-fg-secondary",
				)}
			>
				{date.text}
			</div>

			<div
				className={cn(
					cellBorder,
					"relative z-10 hidden h-full min-w-0 items-center gap-1 px-2 @xl:flex",
				)}
			>
				{owners.map((assignment) => (
					<Tooltip key={assignment.id}>
						<TooltipTrigger asChild>
							<span className="group/assignee relative">
								<UserAvatar
									name={assignment.user.name}
									src={assignment.user.image}
									className="size-6"
									fallbackClassName="text-[10px]"
								/>
								{canPlan && (
									<button
										type="button"
										aria-label={`Unassign ${assignment.user.name}`}
										className="absolute -top-1 -right-1 hidden size-3.5 items-center justify-center rounded-full bg-surface-1 text-fg-tertiary ring-1 ring-subtle group-hover/assignee:flex hover:text-destructive"
										onClick={() =>
											unassignMutation.mutate({
												buildTaskIds: [task.id],
												userId: assignment.userId,
											})
										}
									>
										<XIcon className="size-2.5" />
									</button>
								)}
							</span>
						</TooltipTrigger>
						<TooltipContent>{assignment.user.name}</TooltipContent>
					</Tooltip>
				))}
				{canPlan ? (
					<AssigneePicker
						selectedIds={owners.map((assignment) => assignment.userId)}
						onSelect={(user) =>
							assignMutation.mutate({
								buildTaskIds: [task.id],
								userId: user.id,
								replace: false,
							})
						}
						onDeselect={(user) =>
							unassignMutation.mutate({
								buildTaskIds: [task.id],
								userId: user.id,
							})
						}
						disabled={assignMutation.isPending}
						label={owners.length === 0 ? "Assign" : ""}
						buttonProps={{
							variant: "ghost",
							size: owners.length === 0 ? "xs" : "icon-xs",
							className: "text-fg-tertiary",
							"aria-label": "Add assignee",
						}}
					/>
				) : owners.length === 0 ? (
					<span className="text-xs text-fg-tertiary">Unassigned</span>
				) : null}
			</div>

			<div
				className={cn(
					cellBorder,
					"hidden h-full items-center gap-2.5 px-2 text-xs text-fg-tertiary @3xl:flex",
				)}
			>
				{task.checklistTotalCount > 0 && (
					<span className="inline-flex items-center gap-1 tabular-nums">
						<ListChecksIcon className="size-3.5" />
						{task.checklistDoneCount}/{task.checklistTotalCount}
					</span>
				)}
				{task.requiresPhoto && <CameraIcon className="size-3.5" />}
				{task.requiresComment && <MessageSquareTextIcon className="size-3.5" />}
			</div>

			<div
				className={cn(
					cellBorder,
					"relative z-10 hidden h-full items-center px-2 @xl:flex",
				)}
			>
				{canPlan ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button type="button" className="rounded-md">
								<TaskStatusBadge status={status} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{BuildTaskStatuses.map((next) => (
								<DropdownMenuItem
									key={next}
									disabled={next === status || statusMutation.isPending}
									onClick={() =>
										statusMutation.mutate({ id: task.id, status: next })
									}
								>
									{taskStatusLabels[next]}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<TaskStatusBadge status={status} />
				)}
			</div>
		</li>
	);
}
