"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	CameraIcon,
	ListChecksIcon,
	MessageSquareIcon,
	MoreHorizontalIcon,
	PaperclipIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { AssigneePicker } from "@/components/manufacturing/assignee-picker";
import { BuildGantt } from "@/components/manufacturing/build-gantt";
import {
	formatDate,
	formatEndDate,
} from "@/components/manufacturing/builds-table";
import {
	BuildStatusBadge,
	TaskStatusBadge,
	taskStatusLabels,
} from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/custom/page";
import {
	UnderlinedTabs,
	UnderlinedTabsContent,
	UnderlinedTabsList,
	UnderlinedTabsTrigger,
} from "@/components/ui/custom/underlined-tabs";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user/user-avatar";
import {
	BuildStatus,
	BuildStatuses,
	BuildTaskStatus,
	BuildTaskStatuses,
} from "@/lib/db/schema/enums";
import { trpc } from "@/trpc/client";

const buildStatusLabels: Record<BuildStatus, string> = {
	planned: "Planned",
	active: "Active",
	blocked: "Blocked",
	completed: "Completed",
	archived: "Archived",
};

export function BuildDetail({
	buildId,
	canPlan,
}: {
	buildId: string;
	canPlan: boolean;
	currentUserId: string;
}): React.JSX.Element {
	const utils = trpc.useUtils();
	const router = useRouter();
	const [tab, setTab] = React.useState("tasks");
	const { data: build, isLoading } = trpc.organization.build.get.useQuery({
		id: buildId,
	});

	const invalidate = () => {
		void utils.organization.build.get.invalidate({ id: buildId });
		void utils.organization.build.list.invalidate();
		void utils.organization.build.assignmentGrid.invalidate();
	};

	const assignMutation = trpc.organization.build.assign.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const unassignMutation = trpc.organization.build.unassign.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const statusMutation = trpc.organization.work.updateStatus.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const updateBuildMutation = trpc.organization.build.update.useMutation({
		onSuccess: () => {
			toast.success("Build updated");
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});
	const deleteBuildMutation = trpc.organization.build.delete.useMutation({
		onSuccess: () => {
			toast.success("Build deleted");
			void utils.organization.build.list.invalidate();
			router.push("/dashboard/organization/builds");
		},
		onError: (error) => toast.error(error.message),
	});

	if (isLoading || !build) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	const tasks = build.tasks;
	const done = tasks.filter((task) => task.status === "done").length;
	const titleById = new Map(tasks.map((task) => [task.id, task.title]));

	// Group by phase preserving sort order.
	const groups: Array<{ phase: string | null; items: typeof tasks }> = [];
	for (const task of tasks) {
		const last = groups[groups.length - 1];
		if (last && last.phase === (task.phase ?? null)) last.items.push(task);
		else groups.push({ phase: task.phase ?? null, items: [task] });
	}

	const handleDelete = () => {
		void NiceModal.show(ConfirmationModal, {
			title: `Delete build ${build.serialNumber}?`,
			message:
				"Only possible while no task has been started. All tasks, assignments and documents of this build are removed.",
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				await deleteBuildMutation.mutateAsync({ id: buildId });
			},
		});
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<PageTitle className="truncate">{build.serialNumber}</PageTitle>
						<BuildStatusBadge status={build.status} />
						{build.name && (
							<span className="text-sm text-muted-foreground">
								{build.name}
							</span>
						)}
					</div>
					<p className="mt-1 text-sm text-muted-foreground">
						<Link
							href={`/dashboard/organization/products/${build.product.id}`}
							className="underline-offset-2 hover:underline"
						>
							{build.product.name}
						</Link>
						{build.templateVersion && (
							<>
								{" · "}
								<Link
									href={`/dashboard/organization/templates/${build.templateVersion.templateId}`}
									className="underline-offset-2 hover:underline"
								>
									template v{build.templateVersion.versionNumber}
								</Link>
							</>
						)}
						{" · "}
						{formatDate(build.plannedStartDate)} →{" "}
						{formatEndDate(build.plannedEndDate)}
						{" · "}
						{done}/{tasks.length} tasks done
					</p>
					{build.description && (
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							{build.description}
						</p>
					)}
				</div>
				{canPlan && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" aria-label="More">
								<MoreHorizontalIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Set status</DropdownMenuLabel>
							{BuildStatuses.map((status) => (
								<DropdownMenuItem
									key={status}
									disabled={status === build.status}
									onClick={() =>
										updateBuildMutation.mutate({ id: buildId, status })
									}
								>
									{buildStatusLabels[status]}
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={handleDelete}>
								<Trash2Icon />
								Delete build
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			<UnderlinedTabs
				value={tab}
				onValueChange={(value) => setTab(String(value))}
			>
				<UnderlinedTabsList className="mb-4 sm:-ml-4">
					<UnderlinedTabsTrigger value="tasks">Tasks</UnderlinedTabsTrigger>
					<UnderlinedTabsTrigger value="timeline">
						Timeline
					</UnderlinedTabsTrigger>
				</UnderlinedTabsList>

				<UnderlinedTabsContent value="tasks">
					{tasks.length === 0 ? (
						<p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
							This build has no tasks.
						</p>
					) : (
						<div className="overflow-hidden rounded-lg border">
							{groups.map((group, groupIndex) => (
								<React.Fragment key={`${group.phase ?? "none"}-${groupIndex}`}>
									<div className="border-b bg-muted/40 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
										{group.phase ?? "No phase"}
									</div>
									{group.items.map((task) => {
										const owners = task.assignments.filter(
											(assignment) => assignment.role === "owner",
										);
										const blockers = task.dependencies
											.map((dep) =>
												tasks.find((t) => t.id === dep.dependsOnBuildTaskId),
											)
											.filter((t) => t && t.status !== "done");
										return (
											<div
												key={task.id}
												className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-b-0 hover:bg-muted/30"
											>
												<div className="min-w-0 flex-1 basis-64">
													<div className="flex flex-wrap items-center gap-2">
														<span className="font-medium">{task.title}</span>
														{task.requiresPhoto && (
															<CameraIcon className="size-3.5 text-muted-foreground" />
														)}
														{task.checklistTotalCount > 0 && (
															<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
																<ListChecksIcon className="size-3.5" />
																{task.checklistDoneCount}/
																{task.checklistTotalCount}
															</span>
														)}
														{task.commentCount > 0 && (
															<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
																<MessageSquareIcon className="size-3.5" />
																{task.commentCount}
															</span>
														)}
														{task.attachmentCount > 0 && (
															<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
																<PaperclipIcon className="size-3.5" />
																{task.attachmentCount}
															</span>
														)}
													</div>
													<p className="mt-0.5 text-xs text-muted-foreground">
														{formatDate(task.startDate)} →{" "}
														{formatEndDate(task.endDate)} ·{" "}
														{task.plannedDurationDays}d
														{task.dependencies.length > 0 && (
															<>
																{" · after "}
																{task.dependencies
																	.map(
																		(dep) =>
																			titleById.get(dep.dependsOnBuildTaskId) ??
																			"?",
																	)
																	.join(", ")}
																{blockers.length > 0 &&
																	task.status !== "done" && (
																		<span className="text-amber-600 dark:text-amber-400">
																			{" "}
																			(waiting)
																		</span>
																	)}
															</>
														)}
													</p>
												</div>

												{/* Assignees */}
												<div className="flex items-center gap-1">
													{owners.map((assignment) => (
														<Tooltip key={assignment.id}>
															<TooltipTrigger asChild>
																<span className="group/assignee relative">
																	<UserAvatar
																		name={assignment.user.name}
																		src={assignment.user.image}
																		className="size-7"
																		fallbackClassName="text-xs"
																	/>
																	{canPlan && (
																		<button
																			type="button"
																			aria-label={`Unassign ${assignment.user.name}`}
																			className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-background text-muted-foreground shadow ring-1 ring-border group-hover/assignee:flex hover:text-destructive"
																			onClick={() =>
																				unassignMutation.mutate({
																					buildTaskIds: [task.id],
																					userId: assignment.userId,
																				})
																			}
																		>
																			<XIcon className="size-3" />
																		</button>
																	)}
																</span>
															</TooltipTrigger>
															<TooltipContent>
																{assignment.user.name}
															</TooltipContent>
														</Tooltip>
													))}
													{canPlan ? (
														<AssigneePicker
															selectedIds={owners.map((a) => a.userId)}
															onSelect={(user) =>
																assignMutation.mutate({
																	buildTaskIds: [task.id],
																	userId: user.id,
																	replace: false,
																})
															}
															onDeselect={(user) =>
																unassignMutation.mutate({
																	buildTaskIds: [task.id],
																	userId: user.id,
																})
															}
															disabled={assignMutation.isPending}
															label={owners.length === 0 ? "Assign" : ""}
															buttonProps={{
																variant:
																	owners.length === 0 ? "outline" : "ghost",
																size: owners.length === 0 ? "sm" : "icon-xs",
																"aria-label": "Add assignee",
															}}
														/>
													) : owners.length === 0 ? (
														<span className="text-xs text-muted-foreground">
															Unassigned
														</span>
													) : null}
												</div>

												{/* Status */}
												{canPlan ? (
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<button type="button" className="rounded-md">
																<TaskStatusBadge status={task.status} />
															</button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end">
															{BuildTaskStatuses.map((status) => (
																<DropdownMenuItem
																	key={status}
																	disabled={status === task.status}
																	onClick={() =>
																		statusMutation.mutate({
																			id: task.id,
																			status,
																		})
																	}
																>
																	{taskStatusLabels[status]}
																</DropdownMenuItem>
															))}
														</DropdownMenuContent>
													</DropdownMenu>
												) : (
													<TaskStatusBadge status={task.status} />
												)}
											</div>
										);
									})}
								</React.Fragment>
							))}
						</div>
					)}
				</UnderlinedTabsContent>

				<UnderlinedTabsContent value="timeline">
					<BuildGantt
						tasks={tasks.map((task) => ({
							id: task.id,
							title: task.title,
							phase: task.phase,
							status: task.status as BuildTaskStatus,
							startDate: task.startDate,
							endDate: task.endDate,
							assigneeNames: task.assignments
								.filter((assignment) => assignment.role === "owner")
								.map((assignment) => assignment.user.name),
							dependsOn: task.dependencies.map(
								(dep) => dep.dependsOnBuildTaskId,
							),
						}))}
					/>
				</UnderlinedTabsContent>
			</UnderlinedTabs>
		</div>
	);
}
