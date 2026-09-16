"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { format, isPast, isToday, type Locale, parseISO } from "date-fns";
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

import { TaskStatusBadge } from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/components/work/offline-provider";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import type { BuildTaskStatus } from "@/lib/db/schema/enums";
import type { WorkDictionary } from "@/lib/i18n/work";
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
	if (!task.startDate) return { text: t.list.unscheduled, overdue: false };
	const start = parseISO(task.startDate);
	if (isToday(start)) return { text: t.list.today, overdue: false };
	const overdue = isPast(start) && task.status !== "done";
	return {
		text: format(start, "d. MMM", { locale: dateLocale }),
		overdue,
	};
}

export interface MyTasksListProps {
	/** Task shown in the side peek; its row is highlighted. */
	selectedTaskId?: string | null;
	/**
	 * Called instead of navigating when the caller can show the task next to
	 * the list. Return `false` to fall back to the full page.
	 */
	onOpenTask?: (taskId: string) => boolean;
}

export function MyTasksList({
	selectedTaskId,
	onOpenTask,
}: MyTasksListProps): React.JSX.Element {
	const { t } = useWorkLocale();
	const { pending } = useOffline();
	const [showDone, setShowDone] = React.useState(false);
	const [collapsed, setCollapsed] = React.useState<Set<string>>(
		() => new Set(),
	);
	const {
		data: fetched,
		isLoading,
		refetch,
		isRefetching,
	} = trpc.organization.work.myTasks.useQuery(
		{ includeDone: showDone },
		{ refetchOnWindowFocus: true },
	);

	const toggleSection = (key: string) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
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

	// Status changes still waiting in the offline queue win over server data.
	const data = fetched.map((task) => {
		const queued = pendingStatusFor(pending, task.id);
		return queued === undefined ? task : { ...task, status: queued };
	});

	const active: MyTask[] = [];
	const waiting: MyTask[] = [];
	const done: MyTask[] = [];
	for (const task of data) {
		if (task.status === "done") done.push(task);
		else if (task.openBlockers.length > 0) waiting.push(task);
		else active.push(task);
	}

	const sections = [
		{ key: "ready", title: t.list.ready, tasks: active },
		{ key: "waiting", title: t.list.waiting, tasks: waiting },
		{ key: "done", title: t.list.finished, tasks: showDone ? done : [] },
	].filter((section) => section.tasks.length > 0);

	return (
		<div className="@container flex min-h-full flex-col">
			{/* Toolbar */}
			<div className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-subtle px-2 sm:px-3">
				<Button
					variant="ghost"
					size="sm"
					className="text-fg-secondary"
					onClick={() => setShowDone((value) => !value)}
				>
					<CheckCircle2Icon />
					{showDone ? t.list.hideDone : t.list.showDone}
				</Button>
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

			{data.length === 0 && (
				<div className="px-4 py-16 text-center">
					<CheckCircle2Icon className="mx-auto size-8 text-success" />
					<p className="mt-3 font-medium">{t.list.emptyTitle}</p>
					<p className="text-sm text-fg-secondary">{t.list.emptyHint}</p>
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
											key={task.id}
											task={task}
											selected={task.id === selectedTaskId}
											onOpen={onOpenTask}
										/>
									))}
								</ul>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}

/**
 * One task as a dense row. The whole row opens the task; the circle at the
 * front finishes (or reopens) it in place, like ticking off a todo.
 */
function TaskRow({
	task,
	selected,
	onOpen,
}: {
	task: MyTask;
	selected: boolean;
	onOpen?: (taskId: string) => boolean;
}): React.JSX.Element {
	const { t, dateLocale } = useWorkLocale();
	const offline = useOffline();
	const utils = trpc.useUtils();
	const date = dateLabel(task, t, dateLocale);
	const blocked = task.openBlockers.length > 0;
	const status = task.status as BuildTaskStatus;
	const isDone = status === "done";
	const project =
		task.build.templateVersion?.template.name ?? task.build.name ?? "Project";
	const href = `/dashboard/organization/tasks/${task.id}`;

	const invalidate = () => {
		void utils.organization.work.myTasks.invalidate();
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
				input: { id: task.id, status: variables.status },
			});
		},
	});

	const toggleDone = () => {
		const next: BuildTaskStatus = isDone ? "in_progress" : "done";
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

			{/* Status */}
			<div
				className={cn(cellBorder, "hidden h-full items-center px-2 @xl:flex")}
			>
				<TaskStatusBadge status={status} labels={t.status} />
			</div>
		</li>
	);
}
