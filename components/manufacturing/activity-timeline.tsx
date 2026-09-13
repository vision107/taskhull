"use client";

import type { inferRouterOutputs } from "@trpc/server";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowUpCircleIcon,
	FileStackIcon,
	CheckSquareIcon,
	CircleDotIcon,
	FilePlusIcon,
	HistoryIcon,
	MessageSquareIcon,
	PencilIcon,
	PlusCircleIcon,
	UserMinusIcon,
	UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { taskStatusLabels } from "@/components/manufacturing/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user/user-avatar";
import type { BuildTaskStatus } from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type ActivityEntry =
	inferRouterOutputs<AppRouter>["organization"]["work"]["activity"][number];

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
	"build.created": PlusCircleIcon,
	"build.updated": PencilIcon,
	"build.status_changed": CircleDotIcon,
	"build.upgraded": ArrowUpCircleIcon,
	"build.saved_as_template": FileStackIcon,
	"build.pushed_to_template": FileStackIcon,
	"task.created": PlusCircleIcon,
	"task.updated": PencilIcon,
	"task.status_changed": CircleDotIcon,
	"task.assigned": UserPlusIcon,
	"task.unassigned": UserMinusIcon,
	"task.commented": MessageSquareIcon,
	"task.attachment_added": FilePlusIcon,
	"task.checklist_updated": CheckSquareIcon,
};

function text(value: unknown, fallback = "?"): string {
	return typeof value === "string" || typeof value === "number"
		? String(value)
		: fallback;
}

function statusLabel(value: unknown): string {
	return typeof value === "string"
		? (taskStatusLabels[value as BuildTaskStatus] ?? value)
		: "?";
}

/**
 * One-line, human readable description of an activity row.
 */
function describe(
	entry: ActivityEntry,
	assigneeNames: Map<string, string>,
): React.ReactNode {
	const meta = (entry.metadata ?? {}) as Record<string, unknown>;
	const task = entry.buildTask?.title;

	switch (entry.action) {
		case "build.created":
			return (
				<>
					created the project
					{typeof meta.taskCount === "number" && (
						<> with {meta.taskCount} tasks</>
					)}
				</>
			);
		case "build.updated":
			return <>updated the project</>;
		case "build.status_changed":
			return (
				<>
					set the project to <b>{text(meta.to)}</b>
				</>
			);
		case "build.saved_as_template":
			return (
				<>
					saved the project as template <b>{text(meta.templateName)}</b>
				</>
			);
		case "build.pushed_to_template":
			return (
				<>
					published <b>{text(meta.templateName)}</b>{" "}
					<b>v{text(meta.versionNumber)}</b> from this project
				</>
			);
		case "build.upgraded":
			return (
				<>
					upgraded the project from <b>v{text(meta.fromVersionNumber)}</b> to{" "}
					<b>v{text(meta.toVersionNumber)}</b>
					{" · "}
					{[
						typeof meta.added === "number" && meta.added > 0
							? `${meta.added} added`
							: null,
						typeof meta.updated === "number" && meta.updated > 0
							? `${meta.updated} updated`
							: null,
						typeof meta.removed === "number" && meta.removed > 0
							? `${meta.removed} removed`
							: null,
						typeof meta.kept === "number" && meta.kept > 0
							? `${meta.kept} kept as ad-hoc`
							: null,
					]
						.filter(Boolean)
						.join(", ")}
				</>
			);
		case "task.created":
			return (
				<>
					added task <b>{task}</b>
				</>
			);
		case "task.updated":
			return (
				<>
					edited <b>{task}</b>
				</>
			);
		case "task.status_changed":
			return (
				<>
					moved <b>{task}</b> from {statusLabel(meta.from)} to{" "}
					<b>{statusLabel(meta.to)}</b>
				</>
			);
		case "task.assigned":
			return (
				<>
					assigned <b>{task}</b> to{" "}
					<b>{assigneeNames.get(String(meta.userId)) ?? "a member"}</b>
				</>
			);
		case "task.unassigned":
			return (
				<>
					removed <b>{assigneeNames.get(String(meta.userId)) ?? "a member"}</b>{" "}
					from <b>{task}</b>
				</>
			);
		case "task.commented":
			return (
				<>
					commented on <b>{task}</b>
				</>
			);
		case "task.attachment_added":
			return (
				<>
					added {typeof meta.fileName === "string" ? meta.fileName : "a photo"}{" "}
					to <b>{task}</b>
				</>
			);
		case "task.checklist_updated":
			return (
				<>
					{meta.status === "open" ? "unticked" : "ticked"}{" "}
					<i>{typeof meta.title === "string" ? meta.title : "an item"}</i> on{" "}
					<b>{task}</b>
				</>
			);
		default:
			return <>{entry.action}</>;
	}
}

export function ActivityTimeline({
	buildId,
	buildTaskId,
	limit = 50,
	compact = false,
	linkToTasks = false,
	className,
}: {
	buildId?: string;
	buildTaskId?: string;
	limit?: number;
	/** Smaller type and avatars for the phone UI. */
	compact?: boolean;
	/** Planner view: link the build task to its worker page. */
	linkToTasks?: boolean;
	className?: string;
}): React.JSX.Element {
	const { data, isLoading } = trpc.organization.work.activity.useQuery({
		buildId,
		buildTaskId,
		limit,
	});
	// Names for assignment rows (metadata only carries user ids).
	const { data: members } = trpc.organization.build.assignees.useQuery();
	const assigneeNames = React.useMemo(
		() => new Map((members ?? []).map((m) => [m.id, m.name])),
		[members],
	);

	if (isLoading || !data) {
		return (
			<div className={cn("space-y-3", className)}>
				{[0, 1, 2].map((i) => (
					<Skeleton key={i} className="h-8 w-full" />
				))}
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<p
				className={cn(
					"rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground",
					className,
				)}
			>
				Nothing has happened yet.
			</p>
		);
	}

	return (
		<ol className={cn("relative space-y-0", className)}>
			{data.map((entry, index) => {
				const Icon = icons[entry.action] ?? HistoryIcon;
				const isLast = index === data.length - 1;
				return (
					<li key={entry.id} className="relative flex gap-3 pb-4">
						{!isLast && (
							<span
								aria-hidden
								className="absolute top-7 bottom-0 left-[13px] w-px bg-border"
							/>
						)}
						<span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
							<Icon className="size-3.5 text-muted-foreground" />
						</span>
						<div
							className={cn("min-w-0 flex-1", compact ? "text-xs" : "text-sm")}
						>
							<p className="leading-snug">
								<span className="inline-flex items-center gap-1.5 font-medium">
									{entry.actor && (
										<UserAvatar
											name={entry.actor.name}
											src={entry.actor.image}
											className="size-4"
											fallbackClassName="text-[9px]"
										/>
									)}
									{entry.actor?.name ?? "System"}
								</span>{" "}
								<span className="text-muted-foreground">
									{describe(entry, assigneeNames)}
								</span>
							</p>
							<p className="mt-0.5 text-xs text-muted-foreground">
								{formatDistanceToNow(entry.createdAt, { addSuffix: true })}
								{!buildTaskId && entry.build && (
									<> · {entry.build.serialNumber}</>
								)}
								{linkToTasks && entry.buildTask && (
									<>
										{" · "}
										<Link
											href={`/dashboard/work/tasks/${entry.buildTask.id}`}
											className="underline-offset-2 hover:underline"
										>
											open task
										</Link>
									</>
								)}
							</p>
						</div>
					</li>
				);
			})}
		</ol>
	);
}
