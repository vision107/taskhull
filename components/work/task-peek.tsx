"use client";

import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import * as React from "react";

import { TaskPlannerView } from "@/components/manufacturing/task-detail-sheet";
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
 * Asana-style side peek: on wide screens a task opens next to the list
 * (`?task=`), on phones the caller should navigate to the full page.
 */
export function useTaskPeek(): {
	taskId: string | null;
	showPeek: boolean;
	open: (id: string) => boolean;
	close: () => void;
	setTaskId: (id: string | null) => void;
} {
	const [taskId, setTaskId] = useQueryState("task");
	const canPeek = usePeekAvailable();
	const showPeek = canPeek && Boolean(taskId);

	return {
		taskId,
		showPeek,
		open: (id: string) => {
			if (!canPeek) return false;
			void setTaskId(id);
			return true;
		},
		close: () => {
			void setTaskId(null);
		},
		setTaskId: (id: string | null) => {
			void setTaskId(id);
		},
	};
}

export function TaskPeek({
	taskId,
	canPlan,
	onClose,
	onOpenTask,
}: {
	taskId: string;
	canPlan?: boolean;
	onClose: () => void;
	onOpenTask?: (taskId: string) => void;
}): React.JSX.Element {
	const { t } = useWorkLocale();
	return (
		<aside
			className="min-h-0 w-[min(44rem,50%)] shrink-0 border-l border-subtle bg-surface-1"
			aria-label={t.detail.taskTitle}
		>
			{canPlan ? (
				<TaskPlannerView
					key={taskId}
					taskId={taskId}
					canPlan
					variant="peek"
					onClose={onClose}
					onOpenTask={onOpenTask}
				/>
			) : (
				<WorkTaskDetail
					key={taskId}
					taskId={taskId}
					variant="peek"
					onClose={onClose}
					onOpenTask={onOpenTask}
				/>
			)}
		</aside>
	);
}

/** Full-page task route: related tasks stay on this URL instead of opening a sheet. */
export function TaskPageView({
	taskId,
	canPlan,
}: {
	taskId: string;
	canPlan: boolean;
}): React.JSX.Element {
	const router = useRouter();
	const openTask = (id: string) => {
		router.push(`/dashboard/organization/tasks/${id}`);
	};

	if (canPlan) {
		return (
			<TaskPlannerView
				key={taskId}
				taskId={taskId}
				canPlan
				variant="page"
				onOpenTask={openTask}
			/>
		);
	}

	return <WorkTaskDetail key={taskId} taskId={taskId} onOpenTask={openTask} />;
}
