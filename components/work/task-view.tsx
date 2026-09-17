"use client";

import type * as React from "react";

import { TaskPlannerView } from "@/components/manufacturing/task-detail-sheet";
import { WorkTaskDetail } from "@/components/work/work-task-detail";

export type TaskViewProps = {
	taskId: string;
	canPlan?: boolean;
	/** `sheet` is the modal; `peek` sits next to a list; `page` is the full route. */
	variant?: "sheet" | "peek" | "page";
	onClose?: () => void;
	/** Open another task in this same surface instead of a new sheet. */
	onOpenTask?: (taskId: string) => void;
};

/**
 * One task surface for both roles. Planners get the inline-editable pane;
 * workers get the action bar, offline queue and photo capture. Peek, page
 * and sheet all go through this so the same task looks the same everywhere.
 */
export function TaskView({
	taskId,
	canPlan = false,
	variant = "page",
	onClose,
	onOpenTask,
}: TaskViewProps): React.JSX.Element {
	if (canPlan) {
		return (
			<TaskPlannerView
				taskId={taskId}
				canPlan
				variant={variant}
				onClose={onClose}
				onOpenTask={onOpenTask}
			/>
		);
	}

	return (
		<WorkTaskDetail
			taskId={taskId}
			variant={variant === "sheet" ? "page" : variant}
			onClose={onClose}
			onOpenTask={onOpenTask}
		/>
	);
}
