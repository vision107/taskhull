"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	FileStackIcon,
	MoreHorizontalIcon,
	Trash2Icon,
	UploadIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { ActivityTimeline } from "@/components/manufacturing/activity-timeline";
import { BuildGantt } from "@/components/manufacturing/build-gantt";
import { BuildUpgradeBanner } from "@/components/manufacturing/build-upgrade-banner";
import {
	formatDate,
	formatEndDate,
} from "@/components/manufacturing/builds-table";
import { ProjectTasks } from "@/components/manufacturing/project-tasks";
import { PromoteTemplateModal } from "@/components/manufacturing/promote-template-modal";
import { BuildStatusBadge } from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
	BuildStatus,
	BuildStatuses,
	BuildTaskStatus,
} from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";
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
	selectedTaskId,
	onOpenTask,
}: {
	buildId: string;
	canPlan: boolean;
	currentUserId: string;
	selectedTaskId?: string | null;
	onOpenTask?: (taskId: string) => boolean;
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

	const updateBuildMutation = trpc.organization.build.update.useMutation({
		onSuccess: () => {
			toast.success("Project updated");
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});
	const deleteBuildMutation = trpc.organization.build.delete.useMutation({
		onSuccess: () => {
			toast.success("Project deleted");
			void utils.organization.build.list.invalidate();
			router.push("/dashboard/organization/projects");
		},
		onError: (error) => toast.error(error.message),
	});

	if (isLoading || !build) {
		return (
			<div>
				<div className="flex h-11 items-center gap-2 border-b border-subtle px-3">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-5 w-16" />
				</div>
				<div className="space-y-px px-3 pt-3">
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</div>
		);
	}

	const tasks = build.tasks;
	const done = tasks.filter((task) => task.status === "done").length;
	const linkedTemplate = build.templateVersion?.template ?? null;
	const openPromote = () => {
		void NiceModal.show(PromoteTemplateModal, {
			buildId,
			serialNumber: build.serialNumber,
			linkedTemplate,
			taskCount: tasks.length,
		});
	};

	const handleDelete = () => {
		void NiceModal.show(ConfirmationModal, {
			title: `Delete project ${build.serialNumber}?`,
			message:
				"Only possible while no task has been started. All tasks, assignments and documents of this project are removed.",
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				await deleteBuildMutation.mutateAsync({ id: buildId });
			},
		});
	};

	return (
		<div className="flex min-h-full flex-col">
			<div className="flex shrink-0 flex-col gap-1 border-b border-subtle px-2 py-2 sm:h-11 sm:flex-row sm:items-center sm:gap-2 sm:px-3 sm:py-0">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						<h1 className="truncate text-sm font-semibold">
							{build.name ?? build.serialNumber}
						</h1>
						<BuildStatusBadge status={build.status} />
						{build.name && (
							<span className="hidden truncate text-13 text-fg-tertiary sm:inline">
								{build.serialNumber}
							</span>
						)}
					</div>
					<p className="truncate text-xs text-fg-tertiary">
						{build.templateVersion
							? `${build.templateVersion.template.name} v${build.templateVersion.versionNumber}`
							: "No template"}
						{" · "}
						{formatDate(build.plannedStartDate)} →{" "}
						{formatEndDate(build.plannedEndDate)}
						{" · "}
						{done}/{tasks.length} done
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-0.5">
					{(["tasks", "timeline", "activity"] as const).map((value) => (
						<Button
							key={value}
							variant="ghost"
							size="sm"
							className={cn(
								"text-fg-secondary capitalize",
								tab === value && "bg-layer-1 text-foreground",
							)}
							onClick={() => setTab(value)}
						>
							{value}
						</Button>
					))}
					{canPlan && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="More"
									className="text-fg-secondary"
								>
									<MoreHorizontalIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuGroup>
									<DropdownMenuLabel>Template</DropdownMenuLabel>
									<DropdownMenuItem onClick={openPromote}>
										{linkedTemplate ? <UploadIcon /> : <FileStackIcon />}
										{linkedTemplate
											? `Update ${linkedTemplate.name} from this project…`
											: "Save as template…"}
									</DropdownMenuItem>
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
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
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="destructive" onClick={handleDelete}>
									<Trash2Icon />
									Delete project
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>

			{canPlan &&
				build.status !== BuildStatus.completed &&
				build.status !== BuildStatus.archived && (
					<BuildUpgradeBanner
						buildId={buildId}
						currentVersionNumber={build.templateVersion?.versionNumber ?? null}
						upgrades={build.availableUpgrades}
					/>
				)}

			{tab === "tasks" && (
				<ProjectTasks
					buildId={buildId}
					canPlan={canPlan}
					tasks={tasks}
					selectedTaskId={selectedTaskId}
					onOpenTask={onOpenTask}
				/>
			)}
			{tab === "timeline" && (
				<div className="p-4">
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
				</div>
			)}
			{tab === "activity" && (
				<div className="p-4">
					<ActivityTimeline buildId={buildId} limit={100} linkToTasks />
				</div>
			)}
		</div>
	);
}
