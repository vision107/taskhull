"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { format, isPast, isToday, type Locale, parseISO } from "date-fns";
import {
	CameraIcon,
	CheckCircle2Icon,
	ChevronRightIcon,
	CircleDotIcon,
	CircleIcon,
	EyeIcon,
	ListChecksIcon,
	ListTreeIcon,
	LockIcon,
	MessageSquareTextIcon,
	OctagonAlertIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/components/work/offline-provider";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import type { BuildTaskStatus } from "@/lib/db/schema/enums";
import type { WorkDictionary } from "@/lib/i18n/work";
import { pendingStatusFor } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type MyTask =
	inferRouterOutputs<AppRouter>["organization"]["work"]["myTasks"][number];

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
		text: format(start, "EEE, d. MMM", { locale: dateLocale }),
		overdue,
	};
}

export function MyTasksList(): React.JSX.Element {
	const { t } = useWorkLocale();
	const { pending } = useOffline();
	const [showDone, setShowDone] = React.useState(false);
	const {
		data: fetched,
		isLoading,
		refetch,
		isRefetching,
	} = trpc.organization.work.myTasks.useQuery(
		{ includeDone: showDone },
		{ refetchOnWindowFocus: true },
	);

	if (isLoading || !fetched) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-7 w-32" />
				<div className="space-y-px overflow-hidden rounded-lg border border-subtle">
					<Skeleton className="h-14 w-full rounded-none" />
					<Skeleton className="h-14 w-full rounded-none" />
					<Skeleton className="h-14 w-full rounded-none" />
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

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="tracking-display text-xl font-semibold">
					{t.list.title}
				</h1>
				<Button
					variant="ghost"
					size="sm"
					className="text-fg-secondary"
					onClick={() => refetch()}
					loading={isRefetching}
				>
					{t.list.refresh}
				</Button>
			</div>

			{data.length === 0 && (
				<div className="rounded-lg border border-dashed border-strong px-4 py-12 text-center">
					<CheckCircle2Icon className="mx-auto size-8 text-success" />
					<p className="mt-3 font-medium">{t.list.emptyTitle}</p>
					<p className="text-sm text-fg-secondary">{t.list.emptyHint}</p>
				</div>
			)}

			{active.length > 0 && (
				<Section title={t.list.ready} count={active.length}>
					{active.map((task) => (
						<TaskRow key={task.id} task={task} />
					))}
				</Section>
			)}

			{waiting.length > 0 && (
				<Section title={t.list.waiting} count={waiting.length}>
					{waiting.map((task) => (
						<TaskRow key={task.id} task={task} />
					))}
				</Section>
			)}

			{showDone && done.length > 0 && (
				<Section title={t.list.finished} count={done.length}>
					{done.map((task) => (
						<TaskRow key={task.id} task={task} />
					))}
				</Section>
			)}

			<div className="flex justify-center pt-1">
				<Button
					variant="ghost"
					size="sm"
					className="text-fg-secondary"
					onClick={() => setShowDone((value) => !value)}
				>
					{showDone ? t.list.hideDone : t.list.showDone}
				</Button>
			</div>
		</div>
	);
}

function Section({
	title,
	count,
	children,
}: React.PropsWithChildren<{ title: string; count: number }>) {
	return (
		<section className="space-y-2">
			<h2 className="flex items-baseline gap-1.5 px-1 text-xs font-medium tracking-wide text-fg-tertiary uppercase">
				{title}
				<span className="text-fg-placeholder tabular-nums">{count}</span>
			</h2>
			<ul className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle bg-surface-1">
				{children}
			</ul>
		</section>
	);
}

const statusGlyph: Record<
	BuildTaskStatus,
	{ icon: React.ComponentType<{ className?: string }>; className: string }
> = {
	todo: { icon: CircleIcon, className: "text-fg-placeholder" },
	in_progress: { icon: CircleDotIcon, className: "text-primary" },
	blocked: { icon: OctagonAlertIcon, className: "text-warning" },
	review: { icon: EyeIcon, className: "text-fg-secondary" },
	done: { icon: CheckCircle2Icon, className: "text-success" },
};

function StatusGlyph({
	status,
	label,
}: {
	status: BuildTaskStatus;
	label: string;
}): React.JSX.Element {
	const glyph = statusGlyph[status];
	return (
		<span title={label} className="flex shrink-0 items-center">
			<glyph.icon className={cn("size-[18px]", glyph.className)} />
			<span className="sr-only">{label}</span>
		</span>
	);
}

/**
 * One task as a compact row: status glyph, title with context, and the
 * details a worker needs to pick the next job (date, checklist, requirements).
 * Same row on a phone and on a desktop; only the density changes.
 */
function TaskRow({ task }: { task: MyTask }): React.JSX.Element {
	const { t, dateLocale } = useWorkLocale();
	const date = dateLabel(task, t, dateLocale);
	const blocked = task.openBlockers.length > 0;
	const status = task.status as BuildTaskStatus;
	const project =
		task.build.templateVersion?.template.name ?? task.build.name ?? "Project";

	return (
		<li>
			<Link
				href={`/dashboard/organization/tasks/${task.id}`}
				className={cn(
					"group/row flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-layer-transparent-hover active:bg-layer-1 md:min-h-12 md:py-2",
					status === "done" && "opacity-60",
				)}
			>
				<StatusGlyph status={status} label={t.status[status]} />

				<div className="min-w-0 flex-1">
					<p className="truncate text-sm leading-5 font-medium">
						{task.parent && (
							<span className="text-fg-tertiary">{task.parent.title} › </span>
						)}
						{task.title}
						{blocked && (
							<LockIcon className="ml-1.5 inline size-3.5 align-[-2px] text-fg-tertiary" />
						)}
					</p>
					<p className="truncate text-13 text-fg-tertiary">
						{project} · {task.build.serialNumber}
						{task.phase ? ` · ${task.phase}` : ""}
					</p>
				</div>

				<div className="flex shrink-0 items-center gap-3 text-xs text-fg-tertiary">
					<div className="hidden items-center gap-3 sm:flex">
						{task.checklistTotal > 0 && (
							<span className="inline-flex items-center gap-1 tabular-nums">
								<ListChecksIcon className="size-3.5" />
								{task.checklistDone}/{task.checklistTotal}
							</span>
						)}
						{task.subtaskTotal > 0 && (
							<span className="inline-flex items-center gap-1 tabular-nums">
								<ListTreeIcon className="size-3.5" />
								{task.subtaskDone}/{task.subtaskTotal}
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
					</div>
					<span
						className={cn(
							"whitespace-nowrap tabular-nums",
							date.overdue && "font-medium text-warning",
						)}
					>
						{date.text}
					</span>
					<ChevronRightIcon className="size-4 text-fg-placeholder md:hidden" />
				</div>
			</Link>
		</li>
	);
}
