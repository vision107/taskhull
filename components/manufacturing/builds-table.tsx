"use client";

import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import * as React from "react";

import { BuildStatusBadge } from "@/components/manufacturing/status-badge";
import type { BuildStatus } from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";

export type BuildRow = {
	id: string;
	serialNumber: string;
	name: string | null;
	status: BuildStatus;
	plannedStartDate: string | null;
	plannedEndDate: string | null;
	templateVersion?: {
		id: string;
		versionNumber: number;
		template?: { id: string; name: string } | null;
	} | null;
	taskCount?: number;
	doneTaskCount?: number;
	blockedTaskCount?: number;
};

export function formatDate(value: string | null | undefined): string {
	if (!value) return "–";
	return format(parseISO(value), "d. MMM");
}

/**
 * Scheduled end dates are exclusive (start + duration). Show the last working
 * day instead, which is what people expect to read.
 */
export function formatEndDate(value: string | null | undefined): string {
	if (!value) return "–";
	return format(addDays(parseISO(value), -1), "d. MMM");
}

/**
 * Column layout, driven by the width of this list (not the viewport) so the
 * same rows work on the full Projects page, the dashboard preview, and a
 * template's "used by" list.
 *
 *   narrow  → name (two lines) · status
 *   @2xl    → name · template · status · start · progress
 *   @4xl    → name · template · status · start · end · progress
 */
const gridColumns = (showTemplate: boolean) =>
	showTemplate
		? "grid grid-cols-[minmax(0,1fr)_auto] @2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_6.5rem_10rem] @4xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_6.5rem_6.5rem_11rem]"
		: "grid grid-cols-[minmax(0,1fr)_auto] @2xl:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_10rem] @4xl:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_6.5rem_11rem]";

const cellBorder = "@2xl:border-l @2xl:border-subtle";

export function BuildsTable({
	builds,
	showTemplate = true,
}: {
	builds: BuildRow[];
	showTemplate?: boolean;
}): React.JSX.Element {
	const columns = gridColumns(showTemplate);

	return (
		<div className="@container">
			<div
				className={cn(
					columns,
					"sticky top-0 z-10 hidden h-8 items-center border-b border-subtle bg-surface-1 text-xs text-fg-tertiary @2xl:grid",
				)}
			>
				<div className="px-3">Project</div>
				{showTemplate && <div className={cn(cellBorder, "px-2")}>Template</div>}
				<div className={cn(cellBorder, "px-2")}>Status</div>
				<div className={cn(cellBorder, "px-2")}>Start</div>
				<div className={cn(cellBorder, "hidden px-2 @4xl:block")}>End</div>
				<div className={cn(cellBorder, "px-2")}>Progress</div>
			</div>
			<ul>
				{builds.map((build) => (
					<ProjectRow
						key={build.id}
						build={build}
						showTemplate={showTemplate}
						columns={columns}
					/>
				))}
			</ul>
		</div>
	);
}

function ProjectRow({
	build,
	showTemplate,
	columns,
}: {
	build: BuildRow;
	showTemplate: boolean;
	columns: string;
}): React.JSX.Element {
	const total = build.taskCount ?? 0;
	const done = build.doneTaskCount ?? 0;
	const blocked = build.blockedTaskCount ?? 0;
	const pct = total === 0 ? 0 : Math.round((done / total) * 100);
	const templateName = build.templateVersion?.template?.name;
	const href = `/dashboard/organization/projects/${build.id}`;
	const title = build.name ?? build.serialNumber;
	const subtitle = [
		build.name ? build.serialNumber : null,
		showTemplate && templateName ? templateName : null,
	]
		.filter((part): part is string => Boolean(part))
		.join(" · ");

	return (
		<li
			className={cn(
				columns,
				"relative min-h-13 items-center border-b border-subtle text-sm transition-colors hover:bg-layer-transparent-hover @2xl:min-h-9",
			)}
		>
			<div className="flex min-w-0 items-center gap-2 py-1.5 pr-2 pl-3 @2xl:py-0">
				<span className="size-2 shrink-0 rounded-sm bg-primary/70" />
				<div className="min-w-0 flex-1">
					<Link
						href={href}
						className="block truncate font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
					>
						{title}
					</Link>
					{subtitle && (
						<p className="truncate text-xs text-fg-tertiary @2xl:hidden">
							{subtitle}
						</p>
					)}
				</div>
			</div>

			{showTemplate && (
				<div
					className={cn(
						cellBorder,
						"hidden h-full min-w-0 items-center px-2 @2xl:flex",
					)}
				>
					{build.templateVersion?.template ? (
						<Link
							href={`/dashboard/organization/templates/${build.templateVersion.template.id}`}
							className="relative z-10 truncate text-13 text-fg-secondary hover:underline"
						>
							{build.templateVersion.template.name}
							<span className="ml-1 text-fg-tertiary">
								v{build.templateVersion.versionNumber}
							</span>
						</Link>
					) : (
						<span className="text-13 text-fg-tertiary">ad-hoc</span>
					)}
				</div>
			)}

			<div
				className={cn(
					cellBorder,
					"flex h-full items-center justify-end px-2 @2xl:justify-start",
				)}
			>
				<BuildStatusBadge status={build.status} />
			</div>

			<div
				className={cn(
					cellBorder,
					"hidden h-full items-center px-2 text-13 text-fg-secondary tabular-nums @2xl:flex",
				)}
			>
				{formatDate(build.plannedStartDate)}
			</div>

			<div
				className={cn(
					cellBorder,
					"hidden h-full items-center px-2 text-13 text-fg-secondary tabular-nums @4xl:flex",
				)}
			>
				{formatEndDate(build.plannedEndDate)}
			</div>

			<div
				className={cn(
					cellBorder,
					"hidden h-full items-center gap-2 px-2 @2xl:flex",
				)}
			>
				<div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-layer-1">
					<div
						className={cn(
							"h-full rounded-full",
							blocked > 0 ? "bg-destructive" : "bg-success",
						)}
						style={{ width: `${pct}%` }}
					/>
				</div>
				<span className="w-12 shrink-0 text-right text-xs text-fg-tertiary tabular-nums">
					{done}/{total}
				</span>
			</div>
		</li>
	);
}
