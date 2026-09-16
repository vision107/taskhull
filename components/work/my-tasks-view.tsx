"use client";

import { useQueryState } from "nuqs";
import * as React from "react";

import { MyTasksList } from "@/components/work/my-tasks-list";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import { WorkTaskDetail } from "@/components/work/work-task-detail";

/** Matches Tailwind's `lg` breakpoint: enough room for list + task side by side. */
const PEEK_MEDIA_QUERY = "(min-width: 64rem)";

function usePeekAvailable(): boolean {
	return React.useSyncExternalStore(
		(onChange) => {
			const media = window.matchMedia(PEEK_MEDIA_QUERY);
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		},
		() => window.matchMedia(PEEK_MEDIA_QUERY).matches,
		() => false,
	);
}

/**
 * My tasks with an Asana-style side peek: on wide screens a task opens next
 * to the list (`?task=`), on phones it navigates to the full page. The URL
 * carries the selection so reloads and shared links land on the same view.
 */
export function MyTasksView(): React.JSX.Element {
	const { t } = useWorkLocale();
	const [taskId, setTaskId] = useQueryState("task");
	const canPeek = usePeekAvailable();
	const showPeek = canPeek && Boolean(taskId);

	return (
		<div className="flex h-full min-h-0">
			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
				<MyTasksList
					selectedTaskId={showPeek ? taskId : null}
					onOpenTask={(id) => {
						if (!canPeek) return false;
						void setTaskId(id);
						return true;
					}}
				/>
			</div>
			{showPeek && taskId && (
				<aside
					className="min-h-0 w-[min(44rem,50%)] shrink-0 border-l border-subtle bg-surface-1"
					aria-label={t.detail.taskTitle}
				>
					<WorkTaskDetail
						key={taskId}
						taskId={taskId}
						variant="peek"
						onClose={() => void setTaskId(null)}
					/>
				</aside>
			)}
		</div>
	);
}
