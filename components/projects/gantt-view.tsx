"use client";

import { CalendarOffIcon, Loader2Icon } from "lucide-react";
import * as React from "react";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { TaskDetailPanel } from "@/components/projects/task-detail-panel";
import { trpc } from "@/trpc/client";

interface GanttViewProps {
	projectId: string;
}

export function GanttView({ projectId }: GanttViewProps): React.JSX.Element {
	const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

	const { data: tasks, isLoading } = trpc.organization.task.list.useQuery({
		projectId,
		includeCompleted: true,
	});

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const ganttTasks = (tasks ?? [])
		.filter((t) => t.startDate || t.dueDate)
		.map((t) => ({
			...t,
			predecessorDependencies: [],
			successorDependencies: [],
		}));

	if (ganttTasks.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center text-center">
				<CalendarOffIcon className="mb-3 size-10 text-muted-foreground/30" />
				<p className="font-medium text-muted-foreground">
					No tasks with dates
				</p>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Set start or due dates on your tasks to see them on the Gantt chart.
					Tasks without dates are hidden from this view.
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<GanttChart
				onTaskSelect={setSelectedTaskId}
				projectId={projectId}
				tasks={ganttTasks}
			/>

			{selectedTaskId && (
				<TaskDetailPanel
					onClose={() => setSelectedTaskId(null)}
					taskId={selectedTaskId}
				/>
			)}
		</div>
	);
}
