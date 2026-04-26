"use client";

import {
	addDays,
	addMonths,
	addWeeks,
	differenceInDays,
	eachDayOfInterval,
	eachMonthOfInterval,
	eachWeekOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isToday,
	isWeekend,
	startOfDay,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeScale = "day" | "week" | "month";

interface GanttTask {
	id: string;
	title: string;
	startDate: Date | null;
	dueDate: Date | null;
	completedAt: Date | null;
	priority: string;
	status: { type: string; color: string; name: string } | null;
	assignee: { name: string; image: string | null } | null;
	predecessorDependencies: Array<{
		id: string;
		predecessorId: string;
		type: string;
	}>;
	successorDependencies: Array<{
		id: string;
		successorId: string;
		type: string;
	}>;
}

interface GanttChartProps {
	projectId: string;
	tasks: GanttTask[];
	onTaskSelect: (taskId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMN_WIDTHS: Record<TimeScale, number> = {
	day: 40,
	week: 28,
	month: 18,
};

const ROW_HEIGHT = 36;
const LABEL_WIDTH = 240;
const HEADER_HEIGHT = 48;

// ─── Utilities ────────────────────────────────────────────────────────────────

function getDateColumns(
	start: Date,
	end: Date,
	scale: TimeScale,
): Date[] {
	switch (scale) {
		case "day":
			return eachDayOfInterval({ start, end });
		case "week":
			return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
		case "month":
			return eachMonthOfInterval({ start, end });
	}
}

function getColumnLabel(date: Date, scale: TimeScale): string {
	switch (scale) {
		case "day":
			return format(date, "d");
		case "week":
			return `W${format(date, "w")}`;
		case "month":
			return format(date, "MMM yy");
	}
}

function getGroupLabel(date: Date, scale: TimeScale): string {
	switch (scale) {
		case "day":
			return format(date, "MMMM yyyy");
		case "week":
			return format(date, "MMMM yyyy");
		case "month":
			return format(date, "yyyy");
	}
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GanttChart({
	projectId,
	tasks,
	onTaskSelect,
}: GanttChartProps): React.JSX.Element {
	const [scale, setScale] = React.useState<TimeScale>("week");
	const [viewStart, setViewStart] = React.useState(() =>
		startOfWeek(addWeeks(new Date(), -2), { weekStartsOn: 1 }),
	);
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const isDragging = React.useRef<{
		taskId: string;
		type: "move" | "resize-start" | "resize-end";
		startX: number;
		origStart: Date | null;
		origEnd: Date | null;
	} | null>(null);

	const utils = trpc.useUtils();
	const updateTask = trpc.organization.task.update.useMutation({
		onSuccess: () =>
			utils.organization.task.list.invalidate({ projectId }),
		onError: (err) => toast.error(err.message),
	});

	const colWidth = COLUMN_WIDTHS[scale];

	// Calculate view range (show ~6 months)
	const viewEnd = React.useMemo(() => {
		switch (scale) {
			case "day":
				return addDays(viewStart, 90);
			case "week":
				return addWeeks(viewStart, 26);
			case "month":
				return addMonths(viewStart, 18);
		}
	}, [viewStart, scale]);

	const columns = React.useMemo(
		() => getDateColumns(viewStart, viewEnd, scale),
		[viewStart, viewEnd, scale],
	);

	const totalWidth = columns.length * colWidth;

	// ─── Date positioning helpers ────────────────────────────────────────────

	const dateToX = React.useCallback(
		(date: Date): number => {
			const diff = differenceInDays(startOfDay(date), startOfDay(viewStart));
			switch (scale) {
				case "day":
					return diff * colWidth;
				case "week":
					return (diff / 7) * colWidth;
				case "month":
					return (diff / 30.44) * colWidth;
			}
		},
		[viewStart, scale, colWidth],
	);

	// ─── Drag handlers ────────────────────────────────────────────────────────

	const onMouseDown = (
		e: React.MouseEvent,
		task: GanttTask,
		type: "move" | "resize-start" | "resize-end",
	) => {
		if (!task.startDate || !task.dueDate) return;
		e.preventDefault();
		e.stopPropagation();
		isDragging.current = {
			taskId: task.id,
			type,
			startX: e.clientX,
			origStart: task.startDate,
			origEnd: task.dueDate,
		};
	};

	React.useEffect(() => {
		const onMouseUp = (e: MouseEvent) => {
			if (!isDragging.current) return;
			const { taskId, type, startX, origStart, origEnd } = isDragging.current;
			const dx = e.clientX - startX;
			let daysDelta: number;

			switch (scale) {
				case "day":
					daysDelta = Math.round(dx / colWidth);
					break;
				case "week":
					daysDelta = Math.round((dx / colWidth) * 7);
					break;
				case "month":
					daysDelta = Math.round((dx / colWidth) * 30.44);
					break;
			}

			if (Math.abs(daysDelta) > 0) {
				const updates: { startDate?: Date | null; dueDate?: Date | null } = {};

				if (type === "move") {
					if (origStart) updates.startDate = addDays(origStart, daysDelta);
					if (origEnd) updates.dueDate = addDays(origEnd, daysDelta);
				} else if (type === "resize-start") {
					if (origStart) updates.startDate = addDays(origStart, daysDelta);
				} else {
					if (origEnd) updates.dueDate = addDays(origEnd, daysDelta);
				}

				updateTask.mutate({ id: taskId, ...updates });
			}

			isDragging.current = null;
		};

		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, [scale, colWidth, updateTask]);

	// ─── Scroll to today ─────────────────────────────────────────────────────

	React.useEffect(() => {
		if (scrollRef.current) {
			const todayX = dateToX(new Date());
			scrollRef.current.scrollLeft = Math.max(0, todayX - LABEL_WIDTH - 200);
		}
	}, [dateToX]);

	// ─── Group header labels ─────────────────────────────────────────────────

	const groupHeaders = React.useMemo(() => {
		const groups: Array<{ label: string; startIdx: number; count: number }> = [];
		let currentGroup = "";
		let currentStart = 0;
		let currentCount = 0;

		columns.forEach((date, idx) => {
			const label = getGroupLabel(date, scale);
			if (label !== currentGroup) {
				if (currentGroup) {
					groups.push({ label: currentGroup, startIdx: currentStart, count: currentCount });
				}
				currentGroup = label;
				currentStart = idx;
				currentCount = 1;
			} else {
				currentCount++;
			}
		});
		if (currentGroup) {
			groups.push({ label: currentGroup, startIdx: currentStart, count: currentCount });
		}
		return groups;
	}, [columns, scale]);

	// ─── Dependency arrows ───────────────────────────────────────────────────

	const dependencyPaths = React.useMemo(() => {
		const paths: Array<{ d: string; key: string }> = [];
		const taskMap = new Map(tasks.map((t) => [t.id, t]));

		for (const task of tasks) {
			for (const dep of task.successorDependencies) {
				const pred = taskMap.get(task.id);
				const succ = taskMap.get(dep.successorId);
				if (!pred?.dueDate || !succ?.startDate) continue;

				const predIdx = tasks.indexOf(pred);
				const succIdx = tasks.findIndex((t) => t.id === dep.successorId);
				if (predIdx === -1 || succIdx === -1) continue;

				const x1 = dateToX(pred.dueDate);
				const y1 = HEADER_HEIGHT + predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
				const x2 = dateToX(succ.startDate);
				const y2 = HEADER_HEIGHT + succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

				const midX = (x1 + x2) / 2;
				paths.push({
					d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
					key: `${pred.id}-${dep.successorId}`,
				});
			}
		}
		return paths;
	}, [tasks, dateToX]);

	return (
		<div className="flex h-full flex-col">
			{/* Controls */}
			<div className="flex items-center gap-2 border-b px-4 py-2">
				<div className="flex rounded-md border">
					{(["day", "week", "month"] as TimeScale[]).map((s) => (
						<button
							className={cn(
								"px-3 py-1 text-xs font-medium transition-colors",
								scale === s
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
							key={s}
							onClick={() => setScale(s)}
							type="button"
						>
							{s.charAt(0).toUpperCase() + s.slice(1)}
						</button>
					))}
				</div>
				<div className="flex gap-1">
					<button
						className="rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
						onClick={() => {
							switch (scale) {
								case "day":
									setViewStart((d) => addDays(d, -30));
									break;
								case "week":
									setViewStart((d) => addWeeks(d, -8));
									break;
								case "month":
									setViewStart((d) => addMonths(d, -6));
									break;
							}
						}}
						type="button"
					>
						← Back
					</button>
					<button
						className="rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
						onClick={() =>
							setViewStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
						}
						type="button"
					>
						Today
					</button>
					<button
						className="rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
						onClick={() => {
							switch (scale) {
								case "day":
									setViewStart((d) => addDays(d, 30));
									break;
								case "week":
									setViewStart((d) => addWeeks(d, 8));
									break;
								case "month":
									setViewStart((d) => addMonths(d, 6));
									break;
							}
						}}
						type="button"
					>
						Forward →
					</button>
				</div>
			</div>

			{/* Main Gantt area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Task labels (fixed left) */}
				<div
					className="shrink-0 overflow-y-auto border-r"
					style={{ width: LABEL_WIDTH }}
				>
					{/* Header spacer */}
					<div
						className="border-b bg-muted/30"
						style={{ height: HEADER_HEIGHT }}
					>
						<div className="flex h-full items-end px-3 pb-1">
							<span className="text-muted-foreground text-xs font-medium">
								Task
							</span>
						</div>
					</div>
					{tasks.map((task) => (
						<button
							className="flex w-full cursor-pointer items-center gap-2 border-b px-3 text-left hover:bg-muted/30"
							key={task.id}
							onClick={() => onTaskSelect(task.id)}
							style={{ height: ROW_HEIGHT }}
							type="button"
						>
							{task.status && (
								<span
									className="h-2 w-2 shrink-0 rounded-full"
									style={{ backgroundColor: task.status.color }}
								/>
							)}
							<span className="truncate text-xs">{task.title}</span>
						</button>
					))}
				</div>

				{/* Scrollable chart area */}
				<div className="flex-1 overflow-auto" ref={scrollRef}>
					<div style={{ width: totalWidth, minWidth: "100%" }}>
						{/* Header */}
						<div
							className="sticky top-0 z-10 bg-background"
							style={{ height: HEADER_HEIGHT }}
						>
							{/* Group row */}
							<div
								className="flex border-b bg-muted/20"
								style={{ height: HEADER_HEIGHT / 2 }}
							>
								{groupHeaders.map((group) => (
									<div
										className="shrink-0 border-r px-2 flex items-center"
										key={`${group.label}-${group.startIdx}`}
										style={{ width: group.count * colWidth }}
									>
										<span className="text-[10px] font-medium text-muted-foreground truncate">
											{group.label}
										</span>
									</div>
								))}
							</div>
							{/* Column labels row */}
							<div
								className="flex border-b"
								style={{ height: HEADER_HEIGHT / 2 }}
							>
								{columns.map((date, idx) => (
									<div
										className={cn(
											"flex shrink-0 items-center justify-center border-r text-[10px]",
											isToday(date) &&
												"bg-primary/10 text-primary font-semibold",
											scale === "day" &&
												isWeekend(date) &&
												"bg-muted/30 text-muted-foreground",
										)}
										key={idx}
										style={{ width: colWidth }}
									>
										{getColumnLabel(date, scale)}
									</div>
								))}
							</div>
						</div>

						{/* Grid + Task bars */}
						<svg
							className="overflow-visible"
							style={{
								width: totalWidth,
								height: tasks.length * ROW_HEIGHT,
							}}
						>
							{/* Column grid lines & weekend shading */}
							{columns.map((date, idx) => (
								<g key={idx}>
									{scale === "day" && isWeekend(date) && (
										<rect
											fill="currentColor"
											height={tasks.length * ROW_HEIGHT}
											width={colWidth}
											x={idx * colWidth}
											y={0}
											className="text-muted/20"
										/>
									)}
									<line
										className="stroke-border"
										strokeWidth={1}
										x1={(idx + 1) * colWidth}
										x2={(idx + 1) * colWidth}
										y1={0}
										y2={tasks.length * ROW_HEIGHT}
									/>
								</g>
							))}

							{/* Row lines */}
							{tasks.map((_, idx) => (
								<line
									className="stroke-border"
									key={idx}
									strokeWidth={1}
									x1={0}
									x2={totalWidth}
									y1={(idx + 1) * ROW_HEIGHT}
									y2={(idx + 1) * ROW_HEIGHT}
								/>
							))}

							{/* Today line */}
							{(() => {
								const todayX = dateToX(new Date()) + colWidth / 2;
								if (todayX < 0 || todayX > totalWidth) return null;
								return (
									<line
										className="stroke-primary"
										opacity={0.7}
										strokeWidth={2}
										x1={todayX}
										x2={todayX}
										y1={0}
										y2={tasks.length * ROW_HEIGHT}
									/>
								);
							})()}

							{/* Dependency arrows */}
							{dependencyPaths.map(({ d, key }) => (
								<path
									className="stroke-muted-foreground"
									d={d}
									fill="none"
									key={key}
									markerEnd="url(#arrowhead)"
									strokeDasharray="4,3"
									strokeWidth={1.5}
								/>
							))}

							{/* Arrow marker definition */}
							<defs>
								<marker
									id="arrowhead"
									markerHeight={6}
									markerUnits="strokeWidth"
									markerWidth={6}
									orient="auto"
									refX={6}
									refY={3}
								>
									<path
										className="fill-muted-foreground"
										d="M 0 0 L 6 3 L 0 6 z"
									/>
								</marker>
							</defs>

							{/* Task bars */}
							{tasks.map((task, idx) => {
								if (!task.startDate || !task.dueDate) {
									return null;
								}

								const x = dateToX(task.startDate);
								const endX = dateToX(task.dueDate) + colWidth;
								const barWidth = Math.max(endX - x, colWidth);
								const y = idx * ROW_HEIGHT + 6;
								const barHeight = ROW_HEIGHT - 12;
								const isDone = task.status?.type === "done";
								const isOverdue =
									!isDone && task.dueDate < new Date();

								const barColor = task.status?.color ?? "#6366f1";

								return (
									<g
										key={task.id}
										onMouseDown={(e) =>
											onMouseDown(e, task, "move")
										}
										role="button"
										style={{ cursor: "grab" }}
										tabIndex={0}
									>
										{/* Main bar */}
										<rect
											fill={barColor}
											height={barHeight}
											opacity={isDone ? 0.5 : 0.85}
											rx={3}
											width={barWidth}
											x={x}
											y={y}
										/>

										{/* Progress overlay (if done) */}
										{isDone && (
											<rect
												fill="white"
												height={barHeight}
												opacity={0.3}
												rx={3}
												width={barWidth}
												x={x}
												y={y}
											/>
										)}

										{/* Overdue indicator */}
										{isOverdue && (
											<rect
												fill="#f43f5e"
												height={barHeight}
												opacity={0.3}
												rx={3}
												width={barWidth}
												x={x}
												y={y}
											/>
										)}

										{/* Title text */}
										<foreignObject
											height={barHeight}
											width={barWidth - 12}
											x={x + 6}
											y={y}
										>
											<div
												className="flex h-full items-center"
												style={{
													fontSize: "11px",
													color: "white",
													overflow: "hidden",
													whiteSpace: "nowrap",
													textOverflow: "ellipsis",
													fontWeight: 500,
												}}
											>
												{task.title}
											</div>
										</foreignObject>

										{/* Left resize handle */}
										<rect
											fill="transparent"
											height={barHeight}
											onMouseDown={(e) =>
												onMouseDown(e, task, "resize-start")
											}
											role="slider"
											style={{ cursor: "ew-resize" }}
											tabIndex={0}
											width={8}
											x={x}
											y={y}
										/>
										{/* Right resize handle */}
										<rect
											fill="transparent"
											height={barHeight}
											onMouseDown={(e) =>
												onMouseDown(e, task, "resize-end")
											}
											role="slider"
											style={{ cursor: "ew-resize" }}
											tabIndex={0}
											width={8}
											x={x + barWidth - 8}
											y={y}
										/>

										{/* Click target */}
										<rect
											fill="transparent"
											height={barHeight}
											onClick={() => onTaskSelect(task.id)}
											role="button"
											style={{ cursor: "pointer" }}
											tabIndex={0}
											width={barWidth}
											x={x}
											y={y}
										/>
									</g>
								);
							})}
						</svg>
					</div>
				</div>
			</div>
		</div>
	);
}
