"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { format, isPast, isToday, parseISO } from "date-fns";
import {
	CameraIcon,
	CheckCircle2Icon,
	ChevronRightIcon,
	ListChecksIcon,
	LockIcon,
	MessageSquareTextIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { TaskStatusBadge } from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type MyTask =
	inferRouterOutputs<AppRouter>["organization"]["work"]["myTasks"][number];

function dateLabel(task: MyTask): { text: string; overdue: boolean } {
	if (!task.startDate) return { text: "Unscheduled", overdue: false };
	const start = parseISO(task.startDate);
	if (isToday(start)) return { text: "Today", overdue: false };
	const overdue = isPast(start) && task.status !== "done";
	return { text: format(start, "EEE, MMM d"), overdue };
}

export function MyTasksList(): React.JSX.Element {
	const [showDone, setShowDone] = React.useState(false);
	const { data, isLoading, refetch, isRefetching } =
		trpc.organization.work.myTasks.useQuery(
			{ includeDone: showDone },
			{ refetchOnWindowFocus: true },
		);

	if (isLoading || !data) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-20 w-full rounded-xl" />
				<Skeleton className="h-20 w-full rounded-xl" />
				<Skeleton className="h-20 w-full rounded-xl" />
			</div>
		);
	}

	const active = data.filter(
		(task) => task.status !== "done" && task.openBlockers.length === 0,
	);
	const waiting = data.filter(
		(task) => task.status !== "done" && task.openBlockers.length > 0,
	);
	const done = data.filter((task) => task.status === "done");

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold">My tasks</h1>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => refetch()}
					loading={isRefetching}
				>
					Refresh
				</Button>
			</div>

			{data.length === 0 && (
				<div className="rounded-xl border bg-background px-4 py-10 text-center">
					<CheckCircle2Icon className="mx-auto size-8 text-emerald-500" />
					<p className="mt-2 font-medium">Nothing assigned to you</p>
					<p className="text-sm text-muted-foreground">
						New tasks show up here as soon as a planner assigns them.
					</p>
				</div>
			)}

			{active.length > 0 && (
				<Section title="Ready to work on" count={active.length}>
					{active.map((task) => (
						<TaskCard key={task.id} task={task} />
					))}
				</Section>
			)}

			{waiting.length > 0 && (
				<Section title="Waiting on other tasks" count={waiting.length}>
					{waiting.map((task) => (
						<TaskCard key={task.id} task={task} />
					))}
				</Section>
			)}

			<div className="pt-2">
				<Button
					variant="outline"
					size="sm"
					className="w-full"
					onClick={() => setShowDone((value) => !value)}
				>
					{showDone ? "Hide finished tasks" : "Show finished tasks"}
				</Button>
			</div>

			{showDone && done.length > 0 && (
				<Section title="Finished" count={done.length}>
					{done.map((task) => (
						<TaskCard key={task.id} task={task} />
					))}
				</Section>
			)}
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
			<h2 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{title} · {count}
			</h2>
			<div className="space-y-2">{children}</div>
		</section>
	);
}

function TaskCard({ task }: { task: MyTask }): React.JSX.Element {
	const date = dateLabel(task);
	const blocked = task.openBlockers.length > 0;
	return (
		<Link
			href={`/dashboard/work/tasks/${task.id}`}
			className={cn(
				"flex items-center gap-3 rounded-xl border bg-background p-4 shadow-xs transition-colors active:bg-muted/60",
				task.status === "done" && "opacity-70",
			)}
		>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<p className="truncate font-medium">{task.title}</p>
					{blocked && (
						<LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
					)}
				</div>
				<p className="mt-0.5 truncate text-sm text-muted-foreground">
					{task.build.product.name} · {task.build.serialNumber}
					{task.phase ? ` · ${task.phase}` : ""}
				</p>
				<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					<span
						className={cn(
							date.overdue && "font-medium text-red-600 dark:text-red-400",
						)}
					>
						{date.text}
					</span>
					{task.checklistTotal > 0 && (
						<span className="inline-flex items-center gap-1">
							<ListChecksIcon className="size-3.5" />
							{task.checklistDone}/{task.checklistTotal}
						</span>
					)}
					{task.requiresPhoto && (
						<span className="inline-flex items-center gap-1">
							<CameraIcon className="size-3.5" />
							photo
						</span>
					)}
					{task.requiresComment && (
						<span className="inline-flex items-center gap-1">
							<MessageSquareTextIcon className="size-3.5" />
							comment
						</span>
					)}
					<TaskStatusBadge status={task.status} className="ml-auto" />
				</div>
			</div>
			<ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
