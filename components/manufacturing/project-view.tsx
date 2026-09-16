"use client";

import * as React from "react";

import { BuildDetail } from "@/components/manufacturing/build-detail";
import { TaskPeek, useTaskPeek } from "@/components/work/task-peek";

/**
 * Project page with the same list + side peek as My tasks. On `lg+` a row
 * opens `?task=` next to the list; on a phone it goes to the full task page.
 */
export function ProjectView({
	buildId,
	canPlan,
	currentUserId,
}: {
	buildId: string;
	canPlan: boolean;
	currentUserId: string;
}): React.JSX.Element {
	const peek = useTaskPeek();

	return (
		<div className="flex h-full min-h-0">
			<div className="min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto">
				<BuildDetail
					buildId={buildId}
					canPlan={canPlan}
					currentUserId={currentUserId}
					selectedTaskId={peek.showPeek ? peek.taskId : null}
					onOpenTask={peek.open}
				/>
			</div>
			{peek.showPeek && peek.taskId && (
				<TaskPeek
					taskId={peek.taskId}
					canPlan={canPlan}
					onClose={peek.close}
					onOpenTask={peek.setTaskId}
				/>
			)}
		</div>
	);
}
