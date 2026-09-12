"use client";

import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import * as React from "react";

import { BuildStatusBadge } from "@/components/manufacturing/status-badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { BuildStatus } from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";

export type BuildRow = {
	id: string;
	serialNumber: string;
	name: string | null;
	status: BuildStatus;
	plannedStartDate: string | null;
	plannedEndDate: string | null;
	product?: { id: string; name: string } | null;
	templateVersion?: { id: string; versionNumber: number } | null;
	taskCount?: number;
	doneTaskCount?: number;
	blockedTaskCount?: number;
};

export function formatDate(value: string | null | undefined): string {
	if (!value) return "–";
	return format(parseISO(value), "MMM d");
}

/**
 * Scheduled end dates are exclusive (start + duration). Show the last working
 * day instead, which is what people expect to read.
 */
export function formatEndDate(value: string | null | undefined): string {
	if (!value) return "–";
	return format(addDays(parseISO(value), -1), "MMM d");
}

export function BuildsTable({
	builds,
	showProduct = true,
}: {
	builds: BuildRow[];
	showProduct?: boolean;
}): React.JSX.Element {
	return (
		<div className="overflow-hidden rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Serial</TableHead>
						{showProduct && <TableHead>Product</TableHead>}
						<TableHead>Version</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Start</TableHead>
						<TableHead>End</TableHead>
						<TableHead className="w-48">Progress</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{builds.map((build) => {
						const total = build.taskCount ?? 0;
						const done = build.doneTaskCount ?? 0;
						const blocked = build.blockedTaskCount ?? 0;
						const pct = total === 0 ? 0 : Math.round((done / total) * 100);
						return (
							<TableRow key={build.id} className="hover:bg-muted/40">
								<TableCell>
									<Link
										href={`/dashboard/organization/builds/${build.id}`}
										className="font-medium hover:underline"
									>
										{build.serialNumber}
									</Link>
									{build.name && (
										<span className="ml-2 text-xs text-muted-foreground">
											{build.name}
										</span>
									)}
								</TableCell>
								{showProduct && (
									<TableCell className="text-muted-foreground">
										{build.product ? (
											<Link
												href={`/dashboard/organization/products/${build.product.id}`}
												className="hover:underline"
											>
												{build.product.name}
											</Link>
										) : (
											"–"
										)}
									</TableCell>
								)}
								<TableCell className="text-muted-foreground">
									{build.templateVersion
										? `v${build.templateVersion.versionNumber}`
										: "–"}
								</TableCell>
								<TableCell>
									<BuildStatusBadge status={build.status} />
								</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(build.plannedStartDate)}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{formatEndDate(build.plannedEndDate)}
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
											<div
												className={cn(
													"h-full rounded-full",
													blocked > 0 ? "bg-red-500" : "bg-emerald-500",
												)}
												style={{ width: `${pct}%` }}
											/>
										</div>
										<span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
											{done}/{total}
										</span>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
