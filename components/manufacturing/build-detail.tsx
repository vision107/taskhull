"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	CameraIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	CornerDownRightIcon,
	FileStackIcon,
	ListChecksIcon,
	ListTreeIcon,
	MessageSquareIcon,
	MoreHorizontalIcon,
	PaperclipIcon,
	PlusIcon,
	Trash2Icon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { ActivityTimeline } from "@/components/manufacturing/activity-timeline";
import { AssigneePicker } from "@/components/manufacturing/assignee-picker";
import { BuildGantt } from "@/components/manufacturing/build-gantt";
import { BuildTaskModal } from "@/components/manufacturing/build-task-modal";
import { BuildUpgradeBanner } from "@/components/manufacturing/build-upgrade-banner";
import {
	formatDate,
	formatEndDate,
} from "@/components/manufacturing/builds-table";
import { PromoteTemplateModal } from "@/components/manufacturing/promote-template-modal";
import { QuickAddTask } from "@/components/manufacturing/quick-add-task";
import {
	BuildStatusBadge,
	TaskStatusBadge,
	taskStatusLabels,
} from "@/components/manufacturing/status-badge";
import { openTaskDetail } from "@/components/manufacturing/task-detail-sheet";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/custom/page";
import {
	UnderlinedTabs,
	UnderlinedTabsContent,
	UnderlinedTabsList,
	UnderlinedTabsTrigger,
} from "@/components/ui/custom/underlined-tabs";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user/user-avatar";
import {
	BuildStatus,
	BuildStatuses,
	BuildTaskStatus,
	BuildTaskStatuses,
} from "@/lib/db/schema/enums";
import { formatEffort } from "@/lib/manufacturing/format";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

const buildStatusLabels: Record<BuildStatus, string> = {
	planned: "Planned",
	active: "Active",
	blocked: "Blocked",
	completed: "Completed",
	archived: "Archived",
};

export function BuildDetail({
	buildId,
	canPlan,
}: {
	buildId: string;
	canPlan: boolean;
	currentUserId: string;
}): React.JSX.Element {
	const utils = trpc.useUtils();
	const router = useRouter();
	const [tab, setTab] = React.useState("tasks");
	const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
	const [addingSubtaskFor, setAddingSubtaskFor] = React.useState<string | null>(
		null,
	);
	const { data: build, isLoading } = trpc.organization.build.get.useQuery({
		id: buildId,
	});

	const invalidate = () => {
		void utils.organization.build.get.invalidate({ id: buildId });
		void utils.organization.build.list.invalidate();
		void utils.organization.build.assignmentGrid.invalidate();
	};

	const siblings = React.useMemo(
		() =>
			(build?.tasks ?? []).map((task) => ({
				id: task.id,
				title: task.title,
				phase: task.phase,
			})),
		[build?.tasks],
	);
	const openAddTask = (phase?: string | null) => {
		void NiceModal.show(BuildTaskModal, {
			buildId,
			siblings,
			defaultPhase: phase ?? null,
		});
	};

	const quickAddMutation = trpc.organization.build.createTask.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const quickAdd = (phase: string | null) => (title: string) =>
		quickAddMutation.mutateAsync({
			buildId,
			title,
			phase: phase ?? undefined,
		});
	const quickAddSubtask = (parentTaskId: string) => (title: string) =>
		quickAddMutation.mutateAsync({ buildId, title, parentTaskId });
	const toggleCollapsed = (taskId: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(taskId)) next.delete(taskId);
			else next.add(taskId);
			return next;
		});

	const assignMutation = trpc.organization.build.assign.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const unassignMutation = trpc.organization.build.unassign.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const statusMutation = trpc.organization.work.updateStatus.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const updateBuildMutation = trpc.organization.build.update.useMutation({
		onSuccess: () => {
			toast.success("Project updated");
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});
	const deleteBuildMutation = trpc.organization.build.delete.useMutation({
		onSuccess: () => {
			toast.success("Project deleted");
			void utils.organization.build.list.invalidate();
			router.push("/dashboard/organization/projects");
		},
		onError: (error) => toast.error(error.message),
	});

	if (isLoading || !build) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	const tasks = build.tasks;
	const done = tasks.filter((task) => task.status === "done").length;
	const titleById = new Map(tasks.map((task) => [task.id, task.title]));

	// Subtasks render under their parent; only top-level tasks form groups.
	const subtasksByParent = new Map<string, typeof tasks>();
	for (const task of tasks) {
		if (!task.parentTaskId) continue;
		const list = subtasksByParent.get(task.parentTaskId) ?? [];
		list.push(task);
		subtasksByParent.set(task.parentTaskId, list);
	}
	const topLevel = tasks.filter((task) => !task.parentTaskId);

	// Group by phase preserving sort order.
	const groups: Array<{ phase: string | null; items: typeof tasks }> = [];
	for (const task of topLevel) {
		const last = groups[groups.length - 1];
		if (last && last.phase === (task.phase ?? null)) last.items.push(task);
		else groups.push({ phase: task.phase ?? null, items: [task] });
	}

	const linkedTemplate = build.templateVersion?.template ?? null;
	const openPromote = () => {
		void NiceModal.show(PromoteTemplateModal, {
			buildId,
			serialNumber: build.serialNumber,
			linkedTemplate,
			taskCount: tasks.length,
		});
	};

	const handleDelete = () => {
		void NiceModal.show(ConfirmationModal, {
			title: `Delete project ${build.serialNumber}?`,
			message:
				"Only possible while no task has been started. All tasks, assignments and documents of this project are removed.",
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				await deleteBuildMutation.mutateAsync({ id: buildId });
			},
		});
	};

	const renderTaskRow = (task: (typeof tasks)[number], depth: 0 | 1) => {
		const owners = task.assignments.filter(
			(assignment) => assignment.role === "owner",
		);
		const blockers = task.dependencies
			.map((dep) => tasks.find((t) => t.id === dep.dependsOnBuildTaskId))
			.filter((t) => t && t.status !== "done");
		const subtasks = subtasksByParent.get(task.id) ?? [];
		const isCollapsed = collapsed.has(task.id);
		return (
			<div
				key={task.id}
				className={cn(
					"group/row flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0 hover:bg-muted/30",
					depth === 1 && "pl-11",
				)}
			>
				{depth === 0 && subtasks.length > 0 && (
					<button
						type="button"
						aria-label={isCollapsed ? "Show subtasks" : "Hide subtasks"}
						aria-expanded={!isCollapsed}
						className="-mr-2 -ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
						onClick={() => toggleCollapsed(task.id)}
					>
						{isCollapsed ? (
							<ChevronRightIcon className="size-4" />
						) : (
							<ChevronDownIcon className="size-4" />
						)}
					</button>
				)}
				{depth === 1 && (
					<CornerDownRightIcon className="-mr-2 -ml-1 size-3.5 shrink-0 text-muted-foreground/60" />
				)}
				<button
					type="button"
					onClick={() => openTaskDetail(task.id, canPlan)}
					className="min-w-0 flex-1 basis-64 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-medium hover:underline">{task.title}</span>
						{subtasks.length > 0 && (
							<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
								<ListTreeIcon className="size-3.5" />
								{task.subtaskDoneCount}/{task.subtaskTotalCount}
							</span>
						)}
						{task.sourceTemplateTaskId === null && (
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="rounded border px-1 text-[10px] leading-4 text-muted-foreground">
										ad-hoc
									</span>
								</TooltipTrigger>
								<TooltipContent>
									Added to this unit only; template upgrades leave it untouched.
								</TooltipContent>
							</Tooltip>
						)}
						{task.requiresPhoto && (
							<CameraIcon className="size-3.5 text-muted-foreground" />
						)}
						{task.checklistTotalCount > 0 && (
							<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
								<ListChecksIcon className="size-3.5" />
								{task.checklistDoneCount}/{task.checklistTotalCount}
							</span>
						)}
						{task.commentCount > 0 && (
							<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
								<MessageSquareIcon className="size-3.5" />
								{task.commentCount}
							</span>
						)}
						{task.attachmentCount > 0 && (
							<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
								<PaperclipIcon className="size-3.5" />
								{task.attachmentCount}
							</span>
						)}
					</div>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{formatDate(task.startDate)} → {formatEndDate(task.endDate)} ·{" "}
						{formatEffort(task.plannedDurationDays, task.plannedHours)}
						{task.dependencies.length > 0 && (
							<>
								{" · after "}
								{task.dependencies
									.map((dep) => titleById.get(dep.dependsOnBuildTaskId) ?? "?")
									.join(", ")}
								{blockers.length > 0 && task.status !== "done" && (
									<span className="text-amber-600 dark:text-amber-400">
										{" "}
										(waiting)
									</span>
								)}
							</>
						)}
					</p>
				</button>

				{canPlan && depth === 0 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-xs"
								aria-label="Add subtask"
								className="text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
								onClick={() => {
									setCollapsed((prev) => {
										const next = new Set(prev);
										next.delete(task.id);
										return next;
									});
									setAddingSubtaskFor(task.id);
								}}
							>
								<ListTreeIcon />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Add subtask</TooltipContent>
					</Tooltip>
				)}

				{/* Assignees */}
				<div className="flex items-center gap-1">
					{owners.map((assignment) => (
						<Tooltip key={assignment.id}>
							<TooltipTrigger asChild>
								<span className="group/assignee relative">
									<UserAvatar
										name={assignment.user.name}
										src={assignment.user.image}
										className="size-7"
										fallbackClassName="text-xs"
									/>
									{canPlan && (
										<button
											type="button"
											aria-label={`Unassign ${assignment.user.name}`}
											className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-background text-muted-foreground shadow ring-1 ring-border group-hover/assignee:flex hover:text-destructive"
											onClick={() =>
												unassignMutation.mutate({
													buildTaskIds: [task.id],
													userId: assignment.userId,
												})
											}
										>
											<XIcon className="size-3" />
										</button>
									)}
								</span>
							</TooltipTrigger>
							<TooltipContent>{assignment.user.name}</TooltipContent>
						</Tooltip>
					))}
					{canPlan ? (
						<AssigneePicker
							selectedIds={owners.map((a) => a.userId)}
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
								variant: owners.length === 0 ? "outline" : "ghost",
								size: owners.length === 0 ? "sm" : "icon-xs",
								"aria-label": "Add assignee",
							}}
						/>
					) : owners.length === 0 ? (
						<span className="text-xs text-muted-foreground">Unassigned</span>
					) : null}
				</div>

				{/* Status */}
				{canPlan ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button type="button" className="rounded-md">
								<TaskStatusBadge status={task.status} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{BuildTaskStatuses.map((status) => (
								<DropdownMenuItem
									key={status}
									disabled={status === task.status}
									onClick={() =>
										statusMutation.mutate({
											id: task.id,
											status,
										})
									}
								>
									{taskStatusLabels[status]}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<TaskStatusBadge status={task.status} />
				)}
			</div>
		);
	};

	const renderTaskTree = (task: (typeof tasks)[number]) => {
		const subtasks = subtasksByParent.get(task.id) ?? [];
		const isCollapsed = collapsed.has(task.id);
		const showSubtaskAdd =
			canPlan &&
			!isCollapsed &&
			(subtasks.length > 0 || addingSubtaskFor === task.id);
		return (
			<React.Fragment key={task.id}>
				{renderTaskRow(task, 0)}
				{!isCollapsed && subtasks.map((subtask) => renderTaskRow(subtask, 1))}
				{showSubtaskAdd && (
					<QuickAddTask
						className="border-b pl-11 last:border-b-0"
						placeholder="Add a subtask and press Enter"
						hint={`→ ${task.title}`}
						focusOnMount={addingSubtaskFor === task.id}
						onAdd={quickAddSubtask(task.id)}
					/>
				)}
			</React.Fragment>
		);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<PageTitle className="truncate">{build.serialNumber}</PageTitle>
						<BuildStatusBadge status={build.status} />
						{build.name && (
							<span className="text-sm text-muted-foreground">
								{build.name}
							</span>
						)}
					</div>
					<p className="mt-1 text-sm text-muted-foreground">
						{build.templateVersion ? (
							<Link
								href={`/dashboard/organization/templates/${build.templateVersion.templateId}`}
								className="underline-offset-2 hover:underline"
							>
								{`${build.templateVersion.template.name} v${build.templateVersion.versionNumber}`}
							</Link>
						) : (
							"No template"
						)}
						{" · "}
						{formatDate(build.plannedStartDate)} →{" "}
						{formatEndDate(build.plannedEndDate)}
						{" · "}
						{done}/{tasks.length} tasks done
					</p>
					{build.description && (
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							{build.description}
						</p>
					)}
				</div>
				{canPlan && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" aria-label="More">
								<MoreHorizontalIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Template</DropdownMenuLabel>
								<DropdownMenuItem onClick={openPromote}>
									{linkedTemplate ? <UploadIcon /> : <FileStackIcon />}
									{linkedTemplate
										? `Update ${linkedTemplate.name} from this project…`
										: "Save as template…"}
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuLabel>Set status</DropdownMenuLabel>
								{BuildStatuses.map((status) => (
									<DropdownMenuItem
										key={status}
										disabled={status === build.status}
										onClick={() =>
											updateBuildMutation.mutate({ id: buildId, status })
										}
									>
										{buildStatusLabels[status]}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={handleDelete}>
								<Trash2Icon />
								Delete project
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			{canPlan &&
				build.status !== BuildStatus.completed &&
				build.status !== BuildStatus.archived && (
					<BuildUpgradeBanner
						buildId={buildId}
						currentVersionNumber={build.templateVersion?.versionNumber ?? null}
						upgrades={build.availableUpgrades}
					/>
				)}

			<UnderlinedTabs
				value={tab}
				onValueChange={(value) => setTab(String(value))}
			>
				<UnderlinedTabsList className="mb-4 sm:-ml-4">
					<UnderlinedTabsTrigger value="tasks">Tasks</UnderlinedTabsTrigger>
					<UnderlinedTabsTrigger value="timeline">
						Timeline
					</UnderlinedTabsTrigger>
					<UnderlinedTabsTrigger value="activity">
						Activity
					</UnderlinedTabsTrigger>
				</UnderlinedTabsList>

				<UnderlinedTabsContent value="tasks">
					{tasks.length === 0 ? (
						<div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
							<p>This project has no tasks yet.</p>
							{canPlan && (
								<>
									<QuickAddTask
										className="mx-auto mt-3 max-w-md rounded-md border bg-background text-left"
										placeholder="Type a task title and press Enter"
										onAdd={quickAdd(null)}
									/>
									<Button
										variant="ghost"
										size="sm"
										className="mt-2"
										onClick={() => openAddTask()}
									>
										<PlusIcon />
										Add with details
									</Button>
								</>
							)}
						</div>
					) : (
						<div className="overflow-hidden rounded-lg border">
							{groups.map((group, groupIndex) => (
								<React.Fragment key={`${group.phase ?? "none"}-${groupIndex}`}>
									<div className="flex items-center justify-between border-b bg-muted/40 px-4 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
										{group.phase ?? "No phase"}
										{canPlan && (
											<Button
												variant="ghost"
												size="xs"
												className="-mr-2 tracking-normal normal-case"
												onClick={() => openAddTask(group.phase)}
											>
												<PlusIcon />
												Add task
											</Button>
										)}
									</div>
									{group.items.map((task) => renderTaskTree(task))}
									{canPlan && (
										<QuickAddTask
											className="border-b last:border-b-0"
											onAdd={quickAdd(group.phase)}
											hint={group.phase ? `→ ${group.phase}` : null}
										/>
									)}
								</React.Fragment>
							))}
						</div>
					)}
				</UnderlinedTabsContent>

				<UnderlinedTabsContent value="timeline">
					<BuildGantt
						tasks={tasks.map((task) => ({
							id: task.id,
							title: task.title,
							phase: task.phase,
							status: task.status as BuildTaskStatus,
							startDate: task.startDate,
							endDate: task.endDate,
							assigneeNames: task.assignments
								.filter((assignment) => assignment.role === "owner")
								.map((assignment) => assignment.user.name),
							dependsOn: task.dependencies.map(
								(dep) => dep.dependsOnBuildTaskId,
							),
						}))}
					/>
				</UnderlinedTabsContent>

				<UnderlinedTabsContent value="activity">
					<ActivityTimeline buildId={buildId} limit={100} linkToTasks />
				</UnderlinedTabsContent>
			</UnderlinedTabs>
		</div>
	);
}
