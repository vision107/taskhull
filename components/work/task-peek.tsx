"use client";

import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import * as React from "react";

import { TaskView } from "@/components/work/task-view";
import { useWorkLocale } from "@/components/work/work-locale-provider";

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
function useQueryPeek(param: "task" | "item"): {
	id: string | null;
	showPeek: boolean;
	open: (id: string) => boolean;
	close: () => void;
	setId: (id: string | null) => void;
} {
	const [id, setId] = useQueryState(param);
	const canPeek = usePeekAvailable();
	const showPeek = canPeek && Boolean(id);

	return {
		id,
		showPeek,
		open: (next: string) => {
			if (!canPeek) return false;
			void setId(next);
			return true;
		},
		close: () => {
			void setId(null);
		},
		setId: (next: string | null) => {
			void setId(next);
		},
	};
}

export function useTaskPeek(): {
	taskId: string | null;
	showPeek: boolean;
	open: (id: string) => boolean;
	close: () => void;
	setTaskId: (id: string | null) => void;
} {
	const peek = useQueryPeek("task");
	return {
		taskId: peek.id,
		showPeek: peek.showPeek,
		open: peek.open,
		close: peek.close,
		setTaskId: peek.setId,
	};
}

/** Same two-pane rule as assigned work, keyed on `?item=`. */
export function usePrivateItemPeek(): {
	itemId: string | null;
	showPeek: boolean;
	open: (id: string) => boolean;
	close: () => void;
	setItemId: (id: string | null) => void;
} {
	const peek = useQueryPeek("item");
	return {
		itemId: peek.id,
		showPeek: peek.showPeek,
		open: peek.open,
		close: peek.close,
		setItemId: peek.setId,
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
			<TaskView
				key={taskId}
				taskId={taskId}
				canPlan={canPlan}
				variant="peek"
				onClose={onClose}
				onOpenTask={onOpenTask}
			/>
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

	return (
		<TaskView
			key={taskId}
			taskId={taskId}
			canPlan={canPlan}
			variant="page"
			onOpenTask={openTask}
		/>
	);
}
