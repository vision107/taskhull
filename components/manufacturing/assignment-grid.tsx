"use client";

import { InfoIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { AssigneePicker } from "@/components/manufacturing/assignee-picker";
import {
	BuildStatusBadge,
	taskStatusDot,
	taskStatusLabels,
} from "@/components/manufacturing/status-badge";
import { openTaskDetail } from "@/components/manufacturing/task-detail-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user/user-avatar";
import type { BuildTaskStatus } from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

type GridProps = {
	templateId: string;
	canPlan: boolean;
};

/**
 * Template tasks (rows) × projects (columns). Select any set of cells — most
 * commonly a whole row, i.e. the same task on every open unit — and hand them
 * to one worker in a single action.
 */
export function AssignmentGrid({
	templateId,
	canPlan,
}: GridProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const [includeCompleted, setIncludeCompleted] = React.useState(false);
	const [selected, setSelected] = React.useState<Set<string>>(new Set());

	const { data, isLoading } = trpc.organization.build.assignmentGrid.useQuery({
		templateId,
		includeCompleted,
	});

	const invalidate = () => {
		void utils.organization.build.assignmentGrid.invalidate({ templateId });
		void utils.organization.build.list.invalidate();
		void utils.organization.build.get.invalidate();
	};

	const assignMutation = trpc.organization.build.assign.useMutation({
		onSuccess: (result, input) => {
			toast.success(
				`Assigned ${result.assigned} ${result.assigned === 1 ? "task" : "tasks"}`,
			);
			invalidate();
			setSelected((current) => {
				const next = new Set(current);
				for (const id of input.buildTaskIds) next.delete(id);
				return next;
			});
		},
		onError: (error) => toast.error(error.message),
	});

	const unassignMutation = trpc.organization.build.unassign.useMutation({
		onSuccess: (result) => {
			toast.success(`Unassigned ${result.unassigned} tasks`);
			invalidate();
			setSelected(new Set());
		},
		onError: (error) => toast.error(error.message),
	});

	if (isLoading || !data) {
		return <Skeleton className="h-64 w-full" />;
	}

	const { builds, rows } = data;

	if (builds.length === 0) {
		return (
			<Empty className="border py-12">
				<EmptyHeader>
					<EmptyTitle>No open projects</EmptyTitle>
					<EmptyDescription>
						Create a project from this template and its tasks will show up here,
						one column per unit.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	const toggle = (ids: string[], force?: boolean) => {
		setSelected((current) => {
			const next = new Set(current);
			const allSelected = ids.every((id) => next.has(id));
			const shouldSelect = force ?? !allSelected;
			for (const id of ids) {
				if (shouldSelect) next.add(id);
				else next.delete(id);
			}
			return next;
		});
	};

	const openCellIds = (
		cells: Array<{ id: string; status: BuildTaskStatus } | null>,
	) =>
		cells
			.filter((cell): cell is NonNullable<typeof cell> => Boolean(cell))
			.filter((cell) => cell.status !== "done")
			.map((cell) => cell.id);

	const selectedIds = Array.from(selected);
	const selectedUserIds = new Set<string>();
	for (const row of rows) {
		for (const cell of Object.values(row.cells)) {
			if (cell && selected.has(cell.id)) {
				for (const assignment of cell.assignments) {
					selectedUserIds.add(assignment.userId);
				}
			}
		}
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Switch
						id="grid-include-completed"
						checked={includeCompleted}
						onCheckedChange={(checked) => setIncludeCompleted(checked)}
						size="sm"
					/>
					<Label htmlFor="grid-include-completed" className="font-normal">
						Include completed projects
					</Label>
				</div>

				{canPlan && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							{selectedIds.length === 0
								? "Select cells or a whole row, then assign."
								: `${selectedIds.length} ${selectedIds.length === 1 ? "task" : "tasks"} selected`}
						</span>
						{selectedIds.length > 0 && (
							<>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setSelected(new Set())}
								>
									Clear
								</Button>
								{selectedUserIds.size > 0 && (
									<AssigneePicker
										label="Unassign…"
										selectedIds={Array.from(selectedUserIds)}
										onSelect={(user) =>
											unassignMutation.mutate({
												buildTaskIds: selectedIds,
												userId: user.id,
											})
										}
										onDeselect={(user) =>
											unassignMutation.mutate({
												buildTaskIds: selectedIds,
												userId: user.id,
											})
										}
										disabled={unassignMutation.isPending}
									/>
								)}
								<AssigneePicker
									label="Assign selected to…"
									onSelect={(user) =>
										assignMutation.mutate({
											buildTaskIds: selectedIds,
											userId: user.id,
										})
									}
									disabled={assignMutation.isPending}
									buttonProps={{ variant: "default" }}
								/>
							</>
						)}
					</div>
				)}
			</div>

			<div className="overflow-x-auto rounded-lg border border-subtle">
				<table className="w-full min-w-max border-collapse text-13">
					<thead>
						<tr className="bg-surface-1">
							<th className="sticky left-0 z-10 min-w-52 border-r border-b border-subtle bg-surface-1 px-2 py-1.5 text-left text-xs font-medium text-fg-secondary backdrop-blur">
								Task
							</th>
							{builds.map((build) => {
								const columnIds = openCellIds(
									rows.map((row) => row.cells[build.id] ?? null),
								);
								const allSelected =
									columnIds.length > 0 &&
									columnIds.every((id) => selected.has(id));
								return (
									<th
										key={build.id}
										className="min-w-32 border-r border-b border-subtle px-2 py-1.5 text-left text-xs font-medium last:border-r-0"
									>
										<div className="flex items-start gap-2">
											{canPlan && (
												<Checkbox
													aria-label={`Select all tasks of ${build.serialNumber}`}
													checked={allSelected}
													disabled={columnIds.length === 0}
													onCheckedChange={(checked) =>
														toggle(columnIds, checked === true)
													}
													className="mt-0.5"
												/>
											)}
											<div className="min-w-0">
												<Link
													href={`/dashboard/organization/projects/${build.id}`}
													className="block truncate hover:underline"
												>
													{build.serialNumber}
												</Link>
												<div className="mt-1 flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
													<BuildStatusBadge
														status={build.status}
														className="px-1.5 py-0 text-[10px]"
													/>
													{build.name && (
														<span className="truncate">{build.name}</span>
													)}
												</div>
											</div>
										</div>
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const rowIds = openCellIds(
								builds.map((build) => row.cells[build.id] ?? null),
							);
							const allSelected =
								rowIds.length > 0 && rowIds.every((id) => selected.has(id));
							return (
								<tr key={row.key} className="group h-9">
									<th className="sticky left-0 z-10 border-r border-b border-subtle bg-surface-1 px-2 py-1 text-left font-normal group-hover:bg-layer-transparent-hover">
										<div className="flex items-center gap-2">
											{canPlan && (
												<Checkbox
													aria-label={`Select ${row.title} on all projects`}
													checked={allSelected}
													disabled={rowIds.length === 0}
													onCheckedChange={(checked) =>
														toggle(rowIds, checked === true)
													}
												/>
											)}
											<div className="min-w-0">
												<p className="truncate font-medium">{row.title}</p>
												{row.phase && (
													<p className="text-xs text-muted-foreground">
														{row.phase}
													</p>
												)}
											</div>
											{canPlan && rowIds.length > 0 && (
												<AssigneePicker
													onSelect={(user) =>
														assignMutation.mutate({
															buildTaskIds: rowIds,
															userId: user.id,
														})
													}
													disabled={assignMutation.isPending}
													buttonProps={{
														variant: "ghost",
														size: "xs",
														className:
															"ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
													}}
													label="All"
												/>
											)}
										</div>
									</th>
									{builds.map((build) => {
										const cell = row.cells[build.id];
										if (!cell) {
											return (
												<td
													key={build.id}
													className="border-r border-b border-subtle px-2 py-1 text-center text-fg-tertiary last:border-r-0"
												>
													–
												</td>
											);
										}
										const isSelected = selected.has(cell.id);
										const owners = cell.assignments.filter(
											(assignment) => assignment.role === "owner",
										);
										const selectable = canPlan && cell.status !== "done";
										return (
											<td
												key={build.id}
												className={cn(
													"border-r border-b border-subtle p-0 last:border-r-0",
													isSelected && "bg-primary/10",
												)}
											>
												<div className="flex h-full w-full items-stretch">
													<Tooltip>
														<TooltipTrigger asChild>
															<button
																type="button"
																aria-label="Open task details"
																onClick={() => openTaskDetail(cell.id, canPlan)}
																className="flex shrink-0 items-center pr-1 pl-2 hover:bg-layer-transparent-hover"
															>
																<span
																	className={cn(
																		"size-2.5 rounded-full ring-offset-background",
																		taskStatusDot[cell.status],
																	)}
																/>
																<InfoIcon className="ml-1 size-3 text-muted-foreground/60" />
															</button>
														</TooltipTrigger>
														<TooltipContent>
															{taskStatusLabels[cell.status]} · open details
														</TooltipContent>
													</Tooltip>
													<button
														type="button"
														aria-label={
															selectable
																? "Select task for assignment"
																: "Open task details"
														}
														onClick={() =>
															selectable
																? toggle([cell.id])
																: openTaskDetail(cell.id, canPlan)
														}
														className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 pl-1 text-left hover:bg-layer-transparent-hover"
													>
														{owners.length === 0 ? (
															<span className="text-xs text-muted-foreground">
																Unassigned
															</span>
														) : (
															<span className="flex items-center gap-1">
																{owners.map((assignment) => (
																	<Tooltip key={assignment.id}>
																		<TooltipTrigger asChild>
																			<span>
																				<UserAvatar
																					name={assignment.user.name}
																					src={assignment.user.image}
																					className="size-5"
																					fallbackClassName="text-[9px]"
																				/>
																			</span>
																		</TooltipTrigger>
																		<TooltipContent>
																			{assignment.user.name}
																		</TooltipContent>
																	</Tooltip>
																))}
																{owners.length === 1 && (
																	<span className="truncate text-xs">
																		{owners[0]?.user.name}
																	</span>
																)}
															</span>
														)}
													</button>
												</div>
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
