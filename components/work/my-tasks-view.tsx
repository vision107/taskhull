"use client";

import * as React from "react";

import { MyTasksList } from "@/components/work/my-tasks-list";
import { TaskPeek, useTaskPeek } from "@/components/work/task-peek";

/**
 * My tasks with an Asana-style side peek: on wide screens a task opens next
 * to the list (`?task=`), on phones it navigates to the full page.
 */
export function MyTasksView(): React.JSX.Element {
	const peek = useTaskPeek();

	return (
		<div className="flex h-full min-h-0">
			<div className="min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto">
				<MyTasksList
					selectedTaskId={peek.showPeek ? peek.taskId : null}
					onOpenTask={peek.open}
				/>
			</div>
			{peek.showPeek && peek.taskId && (
				<TaskPeek taskId={peek.taskId} onClose={peek.close} />
			)}
		</div>
	);
}
