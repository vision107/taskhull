"use client";

import NiceModal from "@ebay/nice-modal-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { Locale } from "date-fns";
import {
	CameraIcon,
	CheckCircle2Icon,
	CheckIcon,
	ChevronRightIcon,
	ListChecksIcon,
	ListTreeIcon,
	LockIcon,
	MessageSquareTextIcon,
	RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { AssigneePicker } from "@/components/manufacturing/assignee-picker";
import { TaskStatusBadge } from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user/user-avatar";
import { BlockReasonSheet } from "@/components/work/block-reason-sheet";
import { useOffline } from "@/components/work/offline-provider";
import { PrivateTasksSection } from "@/components/work/private-tasks";
import { useMyTasksFilters } from "@/components/work/use-my-tasks-filters";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import type { BuildTaskStatus } from "@/lib/db/schema/enums";
import type { WorkDictionary } from "@/lib/i18n/work";
import { formatTaskDueLabel } from "@/lib/manufacturing/format";
import {
	filterWorkTasks,
	glanceFromTasks,
	isTypingTarget,
	nextCycledStatus,
	projectLabel,
	sortWorkTasks,
	workSection,
	type WorkListSection,
} from "@/lib/manufacturing/work-list";
import { isNetworkError, pendingStatusFor } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type MyTask =
	inferRouterOutputs<AppRouter>["organization"]["work"]["myTasks"][number];

/**
 * Column layout, driven by the width of the list itself (not the viewport) so
 * the same rows collapse gracefully when the side peek takes half the screen.
 *
 *   narrow  → name (two lines) · due
 *   @xl     → name · due · project · status
 *   @3xl    → name · due · project · progress · status
 */
const gridColumns =
	"grid grid-cols-[minmax(0,1fr)_5.5rem] @xl:grid-cols-[minmax(0,1fr)_7rem_minmax(9rem,13rem)_7.5rem] @3xl:grid-cols-[minmax(0,1fr)_7rem_minmax(9rem,14rem)_9rem_7.5rem]";

const cellBorder = "@xl:border-l @xl:border-subtle";

function dateLabel(
	task: MyTask,
	t: WorkDictionary,
	dateLocale: Locale,
): { text: string; overdue: boolean } {
	return formatTaskDueLabel(task, {
		today: t.list.today,
		unscheduled: t.list.unscheduled,
		locale: dateLocale,
	});
}

export interface MyTasksListProps {
	/** Task shown in the side peek; its row is highlighted. */
	selectedTaskId?: string | null;
	/**
	 * Called instead of navigating when the caller can show the task next to
	 * the list. Return `false` to fall back to the full page.
	 */
	onOpenTask?: (taskId: string) => boolean;
	/** Highlight a row without opening it (keyboard selection). */
	onSelectTask?: (taskId: string | null) => void;
	canPlan?: boolean;
}

export function MyTasksList({
	selectedTaskId,
	onOpenTask,
	onSelectTask,
	canPlan = false,
}: MyTasksListProps): React.JSX.Element {
	const { t } = useWorkLocale();
	const { pending } = useOffline();
	const filters = useMyTasksFilters();
	const searchRef = React.useRef<HTMLInputElement>(null);
	const [collapsed, setCollapsed] = React.useState<Set<string>>(
		() => new Set(),
	);
	const includeDone = filters.section === "done";
	const showTeam = filters.team && canPlan;
	const mineQuery = trpc.organization.work.myTasks.useQuery(
		{ includeDone },
		{ refetchOnWindowFocus: true, enabled: !showTeam },
	);
	const teamQuery = trpc.organization.work.teamTasks.useQuery(
		{ includeDone },
		{ refetchOnWindowFocus: true, enabled: showTeam },
	);
	const fetched = showTeam ? teamQuery.data : mineQuery.data;
	const isLoading = showTeam ? teamQuery.isLoading : mineQuery.isLoading;
	const isRefetching = showTeam
		? teamQuery.isRefetching
		: mineQuery.isRefetching;
	const refetch = showTeam ? teamQuery.refetch : mineQuery.refetch;

	const toggleSection = (key: string) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	const overlayed = React.useMemo(() => {
		if (!fetched) return [];
		return fetched.map((task) => {
			const queued = pendingStatusFor(pending, task.id);
			return queued === undefined ? task : { ...task, status: queued };
		});
	}, [fetched, pending]);

	const visible = React.useMemo(
		() =>
			sortWorkTasks(
				filterWorkTasks(overlayed, {
					section: filters.section,
					projectId: filters.projectId,
					phase: filters.phase,
					due: filters.due,
					query: filters.query,
				}),
				filters.sort,
			),
		[overlayed, filters],
	);

	const glance = glanceFromTasks(overlayed);
	const projects = uniqueProjects(overlayed);
	const phases = uniquePhases(overlayed);
	const visibleIds = visible.map((task) => task.id);

	useTaskListKeyboard({
		visible,
		selectedTaskId,
		onOpenTask,
		onSelectTask,
		focusSearch: () => searchRef.current?.focus(),
		canPlan,
	});

	if (isLoading || !fetched) {
		return (
			<div className="@container">
				<div className="flex h-11 items-center justify-end gap-2 px-3">
					<Skeleton className="h-7 w-28" />
				</div>
				<div className="space-y-px px-3 pt-2">
					<Skeleton className="h-9 w-40" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</div>
		);
	}

	const sections = showTeam
		? teamSections(visible, t.list.unassignedGroup)
		: [
				{
					key: "ready",
					title: t.list.ready,
					tasks: visible.filter((task) => workSection(task) === "ready"),
				},
				{
					key: "waiting",
					title: t.list.waiting,
					tasks: visible.filter((task) => workSection(task) === "waiting"),
				},
				{
					key: "done",
					title: t.list.finished,
					tasks: visible.filter((task) => workSection(task) === "done"),
				},
			].filter((section) => section.tasks.length > 0);

	const emptyTitle = filters.hasFilters
		? t.list.emptyFilteredTitle
		: showTeam
			? t.list.emptyTeamTitle
			: t.list.emptyTitle;
	const emptyHint = filters.hasFilters
		? t.list.emptyFilteredHint
		: showTeam
			? t.list.emptyTeamHint
			: t.list.emptyHint;

	// Offered when pinning a private note to one of the caller's tasks. Only
	// meaningful in the "Mine" view: the private list is the member's own.
	const linkOptions = showTeam
		? []
		: overlayed.map((task) => ({
				id: task.id,
				label: `${task.title} · ${task.build.serialNumber}`,
			}));

	return (
		<div className="@container flex min-h-full flex-col">
			<div className="shrink-0 space-y-2 border-b border-subtle px-2 py-2 sm:px-3">
				<div className="flex flex-wrap items-center gap-2">
					<p className="min-w-0 flex-1 text-13 text-fg-secondary">
						{t.list.glance(glance.ready, glance.waiting, glance.hoursToday)}
					</p>
					{canPlan && (
						<div className="flex rounded-md border border-subtle p-0.5">
							<Chip
								pressed={!filters.team}
								onClick={() => filters.setTeam(false)}
							>
								{t.list.mine}
							</Chip>
							<Chip
								pressed={filters.team}
								onClick={() => filters.setTeam(true)}
							>
								{t.list.team}
							</Chip>
						</div>
					)}
					<Button
						variant="ghost"
						size="icon-sm"
						className="text-fg-secondary"
						aria-label={t.list.refresh}
						onClick={() => refetch()}
						loading={isRefetching}
					>
						<RefreshCwIcon />
					</Button>
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					<SectionChip
						current={filters.section}
						value="ready"
						label={t.list.readyChip}
						onSelect={filters.setSection}
					/>
					<SectionChip
						current={filters.section}
						value="waiting"
						label={t.list.waitingChip}
						onSelect={filters.setSection}
					/>
					<SectionChip
						current={filters.section}
						value="done"
						label={t.list.doneChip}
						onSelect={filters.setSection}
					/>
					<span className="mx-1 hidden h-4 w-px bg-subtle sm:block" />
					<Chip
						pressed={filters.due === "overdue"}
						onClick={() =>
							filters.setDue(filters.due === "overdue" ? null : "overdue")
						}
					>
						{t.list.overdue}
					</Chip>
					<Chip
						pressed={filters.due === "today"}
						onClick={() =>
							filters.setDue(filters.due === "today" ? null : "today")
						}
					>
						{t.list.today}
					</Chip>
					<Chip
						pressed={filters.due === "week"}
						onClick={() =>
							filters.setDue(filters.due === "week" ? null : "week")
						}
					>
						{t.list.thisWeek}
					</Chip>
					<Chip
						pressed={filters.due === "later"}
						onClick={() =>
							filters.setDue(filters.due === "later" ? null : "later")
						}
					>
						{t.list.later}
					</Chip>
					{projects.length > 1 && (
						<select
							aria-label={t.list.columns.project}
							value={filters.projectId ?? ""}
							onChange={(event) =>
								filters.setProjectId(event.target.value || null)
							}
							className="h-7 max-w-40 rounded-md border border-subtle bg-transparent px-2 text-xs"
						>
							<option value="">{t.list.columns.project}</option>
							{projects.map((project) => (
								<option key={project.id} value={project.id}>
									{project.label}
								</option>
							))}
						</select>
					)}
					{phases.length > 1 && (
						<select
							aria-label={t.list.columns.phase}
							value={filters.phase ?? ""}
							onChange={(event) => filters.setPhase(event.target.value || null)}
							className="h-7 max-w-36 rounded-md border border-subtle bg-transparent px-2 text-xs"
						>
							<option value="">{t.list.columns.phase}</option>
							{phases.map((phase) => (
								<option key={phase} value={phase}>
									{phase}
								</option>
							))}
						</select>
					)}
					<select
						aria-label={t.list.sort}
						value={filters.sort}
						onChange={(event) =>
							filters.setSort(event.target.value as typeof filters.sort)
						}
						className="h-7 rounded-md border border-subtle bg-transparent px-2 text-xs"
					>
						<option value="start">{t.list.sortStart}</option>
						<option value="project">{t.list.sortProject}</option>
						<option value="phase">{t.list.sortPhase}</option>
						<option value="effort">{t.list.sortEffort}</option>
					</select>
					<Input
						ref={searchRef}
						data-task-filter=""
						value={filters.query}
						onChange={(event) => filters.setQuery(event.target.value)}
						placeholder={t.list.searchPlaceholder}
						aria-label={t.list.search}
						className="h-7 w-36 border-subtle text-xs sm:w-44"
					/>
					{filters.hasFilters && (
						<Button
							variant="ghost"
							size="xs"
							className="text-fg-secondary"
							onClick={filters.clear}
						>
							{t.list.clearFilters}
						</Button>
					)}
				</div>
			</div>

			{/* Column header: only worth the space once columns exist. */}
			<div
				className={cn(
					gridColumns,
					"sticky top-0 z-10 hidden h-8 shrink-0 items-center border-b border-subtle bg-surface-1 text-xs text-fg-tertiary @xl:grid",
				)}
			>
				<div className="pl-3">{t.list.columns.name}</div>
				<div className={cn(cellBorder, "px-2")}>{t.list.columns.due}</div>
				<div className={cn(cellBorder, "px-2")}>{t.list.columns.project}</div>
				<div className={cn(cellBorder, "hidden px-2 @3xl:block")}>
					{t.list.columns.progress}
				</div>
				<div className={cn(cellBorder, "px-2")}>{t.list.columns.status}</div>
			</div>

			{visible.length === 0 && (
				<div className="px-4 py-16 text-center">
					<CheckCircle2Icon className="mx-auto size-8 text-success" />
					<p className="mt-3 font-medium">{emptyTitle}</p>
					<p className="text-sm text-fg-secondary">{emptyHint}</p>
				</div>
			)}

			<div className="pb-8">
				{sections.map((section) => {
					const isCollapsed = collapsed.has(section.key);
					return (
						<section key={section.key} className="pt-3">
							<button
								type="button"
								onClick={() => toggleSection(section.key)}
								aria-expanded={!isCollapsed}
								aria-label={
									isCollapsed
										? t.list.expand(section.title)
										: t.list.collapse(section.title)
								}
								className="flex h-9 w-full items-center gap-1 px-2 text-left hover:bg-layer-transparent-hover sm:px-3"
							>
								<ChevronRightIcon
									className={cn(
										"size-4 text-fg-tertiary transition-transform",
										!isCollapsed && "rotate-90",
									)}
								/>
								<span className="text-sm font-semibold">{section.title}</span>
								<span className="text-13 text-fg-tertiary tabular-nums">
									{section.tasks.length}
								</span>
							</button>
							{!isCollapsed && (
								<ul className="border-t border-subtle">
									{section.tasks.map((task) => (
										<TaskRow
											key={`${section.key}-${task.id}`}
											task={task}
											selected={task.id === selectedTaskId}
											onOpen={onOpenTask}
											canPlan={canPlan}
											showAssignees={showTeam}
										/>
									))}
								</ul>
							)}
						</section>
					);
				})}

				{/* The member's own notes sit under their assigned work; the team view is someone else's list. */}
				{!showTeam && (
					<div className="px-2 pt-6 sm:px-3">
						<PrivateTasksSection
							showDone={includeDone}
							linkOptions={linkOptions}
						/>
					</div>
				)}
			</div>
			<span className="sr-only">{visibleIds.join(" ")}</span>
		</div>
	);
}

function Chip({
	pressed,
	onClick,
	children,
}: {
	pressed: boolean;
	onClick: () => void;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={onClick}
			className={cn(
				"h-7 rounded-md px-2 text-xs transition-colors",
				pressed
					? "bg-layer-1 text-fg-secondary"
					: "text-fg-tertiary hover:bg-layer-transparent-hover hover:text-fg-secondary",
			)}
		>
			{children}
		</button>
	);
}

function SectionChip({
	current,
	value,
	label,
	onSelect,
}: {
	current: WorkListSection | null;
	value: WorkListSection;
	label: string;
	onSelect: (value: WorkListSection | null) => void;
}): React.JSX.Element {
	return (
		<Chip
			pressed={current === value}
			onClick={() => onSelect(current === value ? null : value)}
		>
			{label}
		</Chip>
	);
}

function uniqueProjects(tasks: MyTask[]): { id: string; label: string }[] {
	const seen = new Map<string, string>();
	for (const task of tasks) {
		if (!seen.has(task.build.id)) {
			seen.set(
				task.build.id,
				`${projectLabel(task)} · ${task.build.serialNumber}`,
			);
		}
	}
	return [...seen.entries()]
		.map(([id, label]) => ({ id, label }))
		.toSorted((a, b) => a.label.localeCompare(b.label));
}

function uniquePhases(tasks: MyTask[]): string[] {
	const phases = new Set<string>();
	for (const task of tasks) {
		if (task.phase) phases.add(task.phase);
	}
	return [...phases].toSorted((a, b) => a.localeCompare(b));
}

function teamSections(
	tasks: MyTask[],
	unassignedLabel: string,
): { key: string; title: string; tasks: MyTask[] }[] {
	const groups = new Map<string, { title: string; tasks: MyTask[] }>();
	for (const task of tasks) {
		const assignees =
			task.assignees.length > 0
				? task.assignees
				: [{ userId: "unassigned", name: unassignedLabel }];
		for (const assignee of assignees) {
			const existing = groups.get(assignee.userId);
			if (existing) existing.tasks.push(task);
			else groups.set(assignee.userId, { title: assignee.name, tasks: [task] });
		}
	}
	return [...groups.entries()]
		.toSorted((a, b) => {
			if (a[0] === "unassigned") return 1;
			if (b[0] === "unassigned") return -1;
			return a[1].title.localeCompare(b[1].title);
		})
		.map(([key, group]) => ({ key, title: group.title, tasks: group.tasks }));
}

function useTaskListKeyboard({
	visible,
	selectedTaskId,
	onOpenTask,
	onSelectTask,
	focusSearch,
	canPlan,
}: {
	visible: MyTask[];
	selectedTaskId?: string | null;
	onOpenTask?: (taskId: string) => boolean;
	onSelectTask?: (taskId: string | null) => void;
	focusSearch: () => void;
	canPlan: boolean;
}) {
	const visibleRef = React.useRef(visible);
	visibleRef.current = visible;
	const selectedRef = React.useRef(selectedTaskId);
	selectedRef.current = selectedTaskId;
	const utils = trpc.useUtils();
	const offline = useOffline();
	const { t } = useWorkLocale();
	const statusMutation = trpc.organization.work.updateStatus.useMutation({
		onSuccess: (_data, variables) => {
			void utils.organization.work.myTasks.invalidate();
			void utils.organization.work.teamTasks.invalidate();
			void utils.organization.work.getTask.invalidate({ id: variables.id });
		},
		onError: (error, variables) => {
			if (isNetworkError(error)) {
				offline.enqueue({
					kind: "updateStatus",
					taskId: variables.id,
					input: {
						id: variables.id,
						status: variables.status,
						reason: variables.reason,
					},
				});
				return;
			}
			toast.error(error.message);
		},
	});

	const mutateStatus = React.useCallback(
		(task: MyTask, status: BuildTaskStatus) => {
			if (status === "blocked") {
				void NiceModal.show(BlockReasonSheet, {
					taskTitle: task.title,
					labels: t.block,
					onSubmit: (reason) => {
						if (!offline.online) {
							offline.enqueue({
								kind: "updateStatus",
								taskId: task.id,
								input: { id: task.id, status, reason },
							});
							return;
						}
						return statusMutation.mutateAsync({
							id: task.id,
							status,
							reason,
						});
					},
				});
				return;
			}
			if (!offline.online) {
				offline.enqueue({
					kind: "updateStatus",
					taskId: task.id,
					input: { id: task.id, status },
				});
				return;
			}
			statusMutation.mutate({ id: task.id, status });
		},
		[offline, statusMutation, t.block],
	);

	React.useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey) {
				return;
			}
			const tasks = visibleRef.current;
			if (event.key === "/") {
				event.preventDefault();
				focusSearch();
				return;
			}
			if (tasks.length === 0) return;
			const index = Math.max(
				0,
				tasks.findIndex((task) => task.id === selectedRef.current),
			);
			if (event.key === "j" || event.key === "ArrowDown") {
				event.preventDefault();
				const next = tasks[Math.min(index + 1, tasks.length - 1)];
				if (next) onSelectTask?.(next.id);
				return;
			}
			if (event.key === "k" || event.key === "ArrowUp") {
				event.preventDefault();
				const next = tasks[Math.max(index - 1, 0)];
				if (next) onSelectTask?.(next.id);
				return;
			}
			const selected =
				tasks.find((task) => task.id === selectedRef.current) ?? tasks[0];
			if (!selected) return;
			if (event.key === "Enter") {
				event.preventDefault();
				if (!onOpenTask?.(selected.id)) {
					window.location.assign(
						`/dashboard/organization/tasks/${selected.id}`,
					);
				}
				return;
			}
			if (event.key === "s") {
				event.preventDefault();
				const next = nextCycledStatus(selected.status as BuildTaskStatus);
				if (next === "done" && selected.openBlockers.length > 0) {
					toast.error(t.list.waiting);
					return;
				}
				mutateStatus(selected, next);
				return;
			}
			if (event.key === "b") {
				event.preventDefault();
				mutateStatus(selected, "blocked");
				return;
			}
			if (event.key === "c") {
				event.preventDefault();
				if (!onOpenTask?.(selected.id) && !canPlan) {
					window.location.assign(
						`/dashboard/organization/tasks/${selected.id}`,
					);
				}
				requestAnimationFrame(() => {
					document
						.querySelector<HTMLTextAreaElement>("[data-task-comment]")
						?.focus();
				});
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		canPlan,
		focusSearch,
		mutateStatus,
		onOpenTask,
		onSelectTask,
		t.list.waiting,
	]);
}

/**
 * One task as a dense row. The whole row opens the task; the circle at the
 * front finishes (or reopens) it in place, like ticking off a todo.
 */
function TaskRow({
	task,
	selected,
	onOpen,
	canPlan,
	showAssignees,
}: {
	task: MyTask;
	selected: boolean;
	onOpen?: (taskId: string) => boolean;
	canPlan: boolean;
	showAssignees: boolean;
}): React.JSX.Element {
	const { t, dateLocale } = useWorkLocale();
	const offline = useOffline();
	const utils = trpc.useUtils();
	const date = dateLabel(task, t, dateLocale);
	const blocked = task.openBlockers.length > 0;
	const status = task.status as BuildTaskStatus;
	const isDone = status === "done";
	const project = projectLabel(task);
	const href = `/dashboard/organization/tasks/${task.id}`;

	const invalidate = () => {
		void utils.organization.work.myTasks.invalidate();
		void utils.organization.work.teamTasks.invalidate();
		void utils.organization.work.getTask.invalidate({ id: task.id });
	};
	const statusMutation = trpc.organization.work.updateStatus.useMutation({
		onSuccess: invalidate,
		onError: (error, variables) => {
			if (!isNetworkError(error)) {
				toast.error(error.message);
				return;
			}
			offline.enqueue({
				kind: "updateStatus",
				taskId: task.id,
				input: {
					id: task.id,
					status: variables.status,
					reason: variables.reason,
				},
			});
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

	const setStatus = (next: BuildTaskStatus) => {
		if (next === "blocked") {
			void NiceModal.show(BlockReasonSheet, {
				taskTitle: task.title,
				labels: t.block,
				onSubmit: (blockReason) => {
					if (!offline.online) {
						offline.enqueue({
							kind: "updateStatus",
							taskId: task.id,
							input: { id: task.id, status: next, reason: blockReason },
						});
						return;
					}
					return statusMutation.mutateAsync({
						id: task.id,
						status: next,
						reason: blockReason,
					});
				},
			});
			return;
		}
		if (!offline.online) {
			offline.enqueue({
				kind: "updateStatus",
				taskId: task.id,
				input: { id: task.id, status: next },
			});
			return;
		}
		statusMutation.mutate({ id: task.id, status: next });
	};

	const toggleDone = () => {
		setStatus(isDone ? "in_progress" : "done");
	};

	const cycleStatus = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const next = nextCycledStatus(status);
		if (next === "done" && blocked) {
			toast.error(t.list.waiting);
			return;
		}
		setStatus(next);
	};

	return (
		<li
			className={cn(
				gridColumns,
				"group/row relative min-h-13 items-center border-b border-subtle text-sm transition-colors @xl:min-h-9",
				selected ? "bg-layer-1" : "hover:bg-layer-transparent-hover",
				isDone && "text-fg-secondary",
			)}
		>
			{/* Name */}
			<div className="flex min-w-0 items-center gap-2 py-1.5 pr-2 pl-2 sm:pl-3 @xl:py-0">
				<button
					type="button"
					aria-label={t.list.markDone(task.title)}
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
						aria-label={t.list.open(task.title)}
						onClick={(event) => {
							if (!onOpen || event.metaKey || event.ctrlKey) return;
							if (onOpen(task.id)) event.preventDefault();
						}}
						className={cn(
							"block truncate leading-5 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset",
							isDone && "line-through",
						)}
					>
						{task.parent && (
							<span className="text-fg-tertiary">{task.parent.title} › </span>
						)}
						{task.title}
					</Link>
					<p className="truncate text-xs text-fg-tertiary @xl:hidden">
						{project} · {task.build.serialNumber}
						{task.phase ? ` · ${task.phase}` : ""}
					</p>
				</div>
				{showAssignees && (
					<div className="relative z-10 flex shrink-0 items-center gap-1">
						{task.assignees.slice(0, 2).map((assignee) => (
							<UserAvatar
								key={assignee.userId}
								name={assignee.name}
								src={assignee.image}
								className="size-5"
								fallbackClassName="text-[9px]"
							/>
						))}
						{canPlan && (
							<AssigneePicker
								selectedIds={task.assignees.map((assignee) => assignee.userId)}
								onSelect={(user) =>
									assignMutation.mutate({
										buildTaskIds: [task.id],
										userId: user.id,
									})
								}
								onDeselect={(user) =>
									unassignMutation.mutate({
										buildTaskIds: [task.id],
										userId: user.id,
									})
								}
								disabled={
									assignMutation.isPending || unassignMutation.isPending
								}
								label={t.list.assignee}
								buttonProps={{
									variant: "ghost",
									size: "xs",
									className:
										"opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
								}}
							/>
						)}
					</div>
				)}
				{blocked && (
					<LockIcon
						className="size-3.5 shrink-0 text-fg-tertiary"
						aria-label={t.list.waiting}
					/>
				)}
				{task.subtaskTotal > 0 && (
					<span
						className="hidden shrink-0 items-center gap-0.5 text-xs text-fg-tertiary tabular-nums @xl:inline-flex"
						title={t.list.subtasks(task.subtaskTotal)}
					>
						<ListTreeIcon className="size-3.5" />
						{task.subtaskDone}/{task.subtaskTotal}
					</span>
				)}
			</div>

			{/* Due */}
			<div
				className={cn(
					cellBorder,
					"flex h-full items-center justify-end px-2 text-xs whitespace-nowrap tabular-nums @xl:justify-start @xl:text-13",
					date.overdue ? "font-medium text-warning" : "text-fg-secondary",
				)}
			>
				{date.text}
				{task.plannedHours != null && (
					<span className="ml-1 text-fg-tertiary">
						{t.list.hoursLeft(task.plannedHours)}
					</span>
				)}
			</div>

			{/* Project */}
			<div
				className={cn(
					cellBorder,
					"hidden h-full min-w-0 items-center px-2 @xl:flex",
				)}
			>
				<span className="inline-flex max-w-full items-center gap-1.5 rounded bg-layer-1 px-1.5 py-px text-xs">
					<span className="size-2 shrink-0 rounded-sm bg-primary/70" />
					<span className="truncate">{project}</span>
					<span className="shrink-0 text-fg-tertiary">
						{task.build.serialNumber}
					</span>
				</span>
			</div>

			{/* Progress & requirements */}
			<div
				className={cn(
					cellBorder,
					"hidden h-full items-center gap-2.5 px-2 text-xs text-fg-tertiary @3xl:flex",
				)}
			>
				{task.checklistTotal > 0 && (
					<span className="inline-flex items-center gap-1 tabular-nums">
						<ListChecksIcon className="size-3.5" />
						{task.checklistDone}/{task.checklistTotal}
					</span>
				)}
				{task.requiresPhoto && (
					<CameraIcon className="size-3.5" aria-label={t.list.photo} />
				)}
				{task.requiresComment && (
					<MessageSquareTextIcon
						className="size-3.5"
						aria-label={t.list.comment}
					/>
				)}
				{task.phase && <span className="truncate">{task.phase}</span>}
			</div>

			{/* Status — click cycles to-do → in progress → done */}
			<div
				className={cn(
					cellBorder,
					"relative z-10 hidden h-full items-center px-2 @xl:flex",
				)}
			>
				<button
					type="button"
					aria-label={t.list.cycleStatus(task.title)}
					onClick={cycleStatus}
					className="rounded-sm"
				>
					<TaskStatusBadge status={status} labels={t.status} />
				</button>
			</div>
		</li>
	);
}
