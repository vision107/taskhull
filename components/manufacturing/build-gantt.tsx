"use client";

import {
	addDays,
	differenceInCalendarDays,
	format,
	isWeekend,
	max as maxDate,
	min as minDate,
	parseISO,
	startOfDay,
} from "date-fns";
import * as React from "react";

import { taskStatusDot } from "@/components/manufacturing/status-badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BuildTaskStatus } from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";

export type GanttTask = {
	id: string;
	title: string;
	phase: string | null;
	status: BuildTaskStatus;
	startDate: string | null;
	endDate: string | null;
	assigneeNames: string[];
	dependsOn: string[];
};

const DAY_WIDTH = 28;
const LABEL_WIDTH = 220;

/**
 * Lightweight day-scale gantt. One row per task, bars positioned from the
 * scheduled start/end dates, coloured by status. Weekends are shaded and
 * today is marked.
 */
export function BuildGantt({
	tasks,
}: {
	tasks: GanttTask[];
}): React.JSX.Element {
	const dated = tasks.filter((task) => task.startDate && task.endDate);

	if (dated.length === 0) {
		return (
			<p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
				No scheduled tasks yet.
			</p>
		);
	}

	const today = startOfDay(new Date());
	const starts = dated.map((task) => parseISO(task.startDate!));
	const ends = dated.map((task) => parseISO(task.endDate!));
	const rangeStart = addDays(minDate([...starts, today]), -1);
	const rangeEnd = addDays(maxDate([...ends, today]), 2);
	const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
	const days = Array.from({ length: totalDays }, (_, i) =>
		addDays(rangeStart, i),
	);
	const titleById = new Map(tasks.map((task) => [task.id, task.title]));

	// Month header segments.
	const months: Array<{ label: string; span: number }> = [];
	for (const day of days) {
		const label = format(day, "MMMM yyyy");
		const last = months[months.length - 1];
		if (last && last.label === label) last.span += 1;
		else months.push({ label, span: 1 });
	}

	const todayOffset = differenceInCalendarDays(today, rangeStart);

	return (
		<div className="overflow-x-auto rounded-lg border">
			<div
				className="relative text-xs"
				style={{ width: LABEL_WIDTH + totalDays * DAY_WIDTH }}
			>
				{/* Month row */}
				<div className="flex border-b bg-muted/40">
					<div
						className="sticky left-0 z-10 shrink-0 border-r bg-muted/40 px-3 py-1 font-medium"
						style={{ width: LABEL_WIDTH }}
					>
						Task
					</div>
					{months.map((month) => (
						<div
							key={month.label}
							className="shrink-0 border-r px-2 py-1 font-medium last:border-r-0"
							style={{ width: month.span * DAY_WIDTH }}
						>
							{month.label}
						</div>
					))}
				</div>
				{/* Day row */}
				<div className="flex border-b">
					<div
						className="sticky left-0 z-10 shrink-0 border-r bg-background"
						style={{ width: LABEL_WIDTH }}
					/>
					{days.map((day) => (
						<div
							key={day.toISOString()}
							className={cn(
								"shrink-0 py-1 text-center text-muted-foreground tabular-nums",
								isWeekend(day) && "bg-muted/50",
								differenceInCalendarDays(day, today) === 0 &&
									"font-semibold text-foreground",
							)}
							style={{ width: DAY_WIDTH }}
						>
							{format(day, "d")}
						</div>
					))}
				</div>

				{/* Rows */}
				{tasks.map((task) => {
					const hasDates = Boolean(task.startDate && task.endDate);
					const offset = hasDates
						? differenceInCalendarDays(parseISO(task.startDate!), rangeStart)
						: 0;
					// End dates are exclusive (start + duration), so a 2‑day task spans
					// exactly two day columns.
					const length = hasDates
						? Math.max(
								differenceInCalendarDays(
									parseISO(task.endDate!),
									parseISO(task.startDate!),
								),
								1,
							)
						: 0;
					return (
						<div key={task.id} className="flex border-b last:border-b-0">
							<div
								className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-background px-3 py-1.5"
								style={{ width: LABEL_WIDTH }}
							>
								<span
									className={cn(
										"size-2 shrink-0 rounded-full",
										taskStatusDot[task.status],
									)}
								/>
								<span className="truncate">{task.title}</span>
							</div>
							<div
								className="relative shrink-0"
								style={{ width: totalDays * DAY_WIDTH, height: 30 }}
							>
								{/* weekend shading */}
								{days.map((day, index) =>
									isWeekend(day) ? (
										<div
											key={day.toISOString()}
											className="absolute inset-y-0 bg-muted/40"
											style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}
										/>
									) : null,
								)}
								{/* today */}
								{todayOffset >= 0 && todayOffset < totalDays && (
									<div
										className="absolute inset-y-0 w-px bg-primary/60"
										style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
									/>
								)}
								{hasDates && (
									<Tooltip>
										<TooltipTrigger asChild>
											<div
												className={cn(
													"absolute top-1.5 h-[18px] rounded-sm px-1.5 text-[11px] leading-[18px] text-white shadow-sm",
													taskStatusDot[task.status],
													task.status === "todo" && "text-foreground",
												)}
												style={{
													left: offset * DAY_WIDTH + 2,
													width: Math.max(
														length * DAY_WIDTH - 4,
														DAY_WIDTH - 4,
													),
												}}
											>
												<span className="block truncate">
													{task.assigneeNames.join(", ")}
												</span>
											</div>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p className="font-medium">{task.title}</p>
											<p>
												{format(parseISO(task.startDate!), "MMM d")} –{" "}
												{format(addDays(parseISO(task.endDate!), -1), "MMM d")}{" "}
												({length}d)
											</p>
											{task.assigneeNames.length > 0 && (
												<p>{task.assigneeNames.join(", ")}</p>
											)}
											{task.dependsOn.length > 0 && (
												<p className="text-muted-foreground">
													After:{" "}
													{task.dependsOn
														.map((id) => titleById.get(id) ?? "?")
														.join(", ")}
												</p>
											)}
										</TooltipContent>
									</Tooltip>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
