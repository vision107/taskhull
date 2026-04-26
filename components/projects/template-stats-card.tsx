"use client";

import { CheckCircle2Icon, HistoryIcon, Loader2Icon } from "lucide-react";
import type * as React from "react";
import { trpc } from "@/trpc/client";

interface TemplateStatsCardProps {
	taskId: string;
}

function formatHours(value: number | null): string {
	if (value === null || Number.isNaN(value)) return "—";
	if (value === 0) return "0h";
	if (value < 1) return `${(value * 60).toFixed(0)}m`;
	return `${value.toFixed(1)}h`;
}

export function TemplateStatsCard({
	taskId,
}: TemplateStatsCardProps): React.JSX.Element | null {
	const { data, isLoading } =
		trpc.organization.task.getTemplateStats.useQuery({ taskId });

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 rounded-md border bg-muted/20 p-3 text-muted-foreground text-xs">
				<Loader2Icon className="size-3 animate-spin" />
				Loading template history…
			</div>
		);
	}

	if (!data || data.instanceCount <= 1) {
		return null;
	}

	const estimateDelta =
		data.avgActualHours !== null && data.avgEstimatedHours !== null
			? data.avgActualHours - data.avgEstimatedHours
			: null;

	return (
		<div className="rounded-md border bg-muted/20 p-3">
			<div className="mb-2 flex items-center gap-1.5">
				<HistoryIcon className="size-3.5 text-muted-foreground" />
				<p className="font-medium text-xs">Across series</p>
			</div>
			<div className="grid grid-cols-2 gap-3 text-xs">
				<Stat
					label="Instances"
					value={`${data.instanceCount}`}
					sub={`${data.completedCount} done`}
				/>
				<Stat
					label="Avg estimate"
					value={formatHours(data.avgEstimatedHours)}
				/>
				<Stat
					label="Avg actual"
					value={formatHours(data.avgActualHours)}
					highlight={
						estimateDelta !== null && estimateDelta > 0
							? "over"
							: estimateDelta !== null && estimateDelta < 0
								? "under"
								: undefined
					}
				/>
				<Stat
					label="Delta"
					value={
						estimateDelta === null
							? "—"
							: `${estimateDelta > 0 ? "+" : ""}${estimateDelta.toFixed(1)}h`
					}
					highlight={
						estimateDelta !== null && estimateDelta > 0
							? "over"
							: estimateDelta !== null && estimateDelta < 0
								? "under"
								: undefined
					}
				/>
			</div>
			{data.recent.length > 0 && (
				<div className="mt-3 space-y-1 border-t pt-2">
					<p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
						Previous runs
					</p>
					{data.recent.map((item) => (
						<div
							className="flex items-center justify-between text-[11px]"
							key={item.id}
						>
							<div className="flex items-center gap-1.5 truncate">
								{item.completed && (
									<CheckCircle2Icon className="size-3 shrink-0 text-green-600" />
								)}
								<span className="truncate text-muted-foreground">
									{item.projectName}
								</span>
							</div>
							<span className="shrink-0 text-muted-foreground">
								{formatHours(item.actualHours)}
								{item.estimatedHours !== null && (
									<span className="opacity-60">
										{" / "}
										{formatHours(item.estimatedHours)}
									</span>
								)}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function Stat({
	label,
	value,
	sub,
	highlight,
}: {
	label: string;
	value: string;
	sub?: string;
	highlight?: "over" | "under";
}): React.JSX.Element {
	return (
		<div>
			<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
				{label}
			</p>
			<p
				className={
					highlight === "over"
						? "font-medium text-orange-600"
						: highlight === "under"
							? "font-medium text-green-600"
							: "font-medium"
				}
			>
				{value}
			</p>
			{sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
		</div>
	);
}
