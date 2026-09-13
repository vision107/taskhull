"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CameraIcon,
	FileIcon,
	ListChecksIcon,
	MessageSquareTextIcon,
	PlusIcon,
	RocketIcon,
	Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { PublishVersionModal } from "@/components/manufacturing/publish-version-modal";
import { QuickAddTask } from "@/components/manufacturing/quick-add-task";
import { VersionStatusBadge } from "@/components/manufacturing/status-badge";
import { TemplateTaskModal } from "@/components/manufacturing/template-task-modal";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatEffort, formatHours } from "@/lib/manufacturing/format";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface TemplateVersionEditorProps {
	templateId: string;
	versionId: string;
	canPlan: boolean;
	hasOtherVersions: boolean;
}

export function TemplateVersionEditor({
	templateId,
	versionId,
	canPlan,
	hasOtherVersions,
}: TemplateVersionEditorProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const { data: version, isLoading } =
		trpc.organization.template.getVersion.useQuery({ versionId });

	const invalidate = () => {
		void utils.organization.template.getVersion.invalidate({ versionId });
		void utils.organization.template.get.invalidate({ id: templateId });
	};

	const quickAddMutation = trpc.organization.template.createTask.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});
	const quickAdd = (phase: string | null) => (title: string) =>
		quickAddMutation.mutateAsync({
			versionId,
			title,
			phase: phase ?? undefined,
		});

	const reorderMutation = trpc.organization.template.reorderTasks.useMutation({
		onSuccess: invalidate,
		onError: (error) => toast.error(error.message),
	});

	const deleteTaskMutation = trpc.organization.template.deleteTask.useMutation({
		onSuccess: () => {
			toast.success("Task removed");
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	const discardMutation = trpc.organization.template.discardDraft.useMutation({
		onSuccess: () => {
			toast.success("Draft discarded");
			void utils.organization.template.get.invalidate({ id: templateId });
			void utils.organization.template.list.invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	if (isLoading || !version) {
		return <Skeleton className="h-64 w-full" />;
	}

	const isDraft = version.status === "draft";
	const editable = canPlan && isDraft;
	const tasks = version.tasks;
	const titleById = new Map(tasks.map((task) => [task.id, task.title]));

	const move = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= tasks.length) return;
		const ordered = tasks.map((task) => task.id);
		const [moved] = ordered.splice(index, 1);
		ordered.splice(target, 0, moved!);
		reorderMutation.mutate({ versionId, orderedTaskIds: ordered });
	};

	const openTask = (taskId?: string) => {
		void NiceModal.show(TemplateTaskModal, {
			templateId,
			versionId,
			taskId,
			readOnly: !editable,
		});
	};

	const handleDelete = (task: { id: string; title: string }) => {
		void NiceModal.show(ConfirmationModal, {
			title: `Remove "${task.title}"?`,
			message:
				"The task, its checklist, documents and dependencies are removed from this draft.",
			confirmLabel: "Remove",
			destructive: true,
			onConfirm: async () => {
				await deleteTaskMutation.mutateAsync({ id: task.id });
			},
		});
	};

	const handleDiscard = () => {
		void NiceModal.show(ConfirmationModal, {
			title: `Discard draft v${version.versionNumber}?`,
			message: hasOtherVersions
				? "All changes in this draft are lost. Published versions are not affected."
				: "All tasks in this draft are removed. The template stays, with an empty draft.",
			confirmLabel: "Discard",
			destructive: true,
			onConfirm: async () => {
				await discardMutation.mutateAsync({ versionId });
			},
		});
	};

	// Group tasks by phase, preserving sort order.
	const groups: Array<{ phase: string | null; items: typeof tasks }> = [];
	for (const task of tasks) {
		const last = groups[groups.length - 1];
		if (last && last.phase === (task.phase ?? null)) {
			last.items.push(task);
		} else {
			groups.push({ phase: task.phase ?? null, items: [task] });
		}
	}

	const totalDays = tasks.reduce((sum, task) => sum + task.durationDays, 0);
	const totalHours = tasks.reduce(
		(sum, task) => sum + (task.plannedHours ?? 0),
		0,
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span className="font-medium text-foreground">
						Version {version.versionNumber}
					</span>
					<VersionStatusBadge status={version.status} />
					<span>
						· {tasks.length} {tasks.length === 1 ? "task" : "tasks"} ·{" "}
						{totalDays} work {totalDays === 1 ? "day" : "days"} total
						{totalHours > 0 && ` · ${formatHours(totalHours)} effort`}
					</span>
				</div>
				{editable && (
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							onClick={handleDiscard}
							disabled={discardMutation.isPending}
						>
							Discard draft
						</Button>
						<Button variant="outline" onClick={() => openTask()}>
							<PlusIcon />
							Add task
						</Button>
						<Button
							onClick={() =>
								NiceModal.show(PublishVersionModal, {
									templateId,
									versionId,
									versionNumber: version.versionNumber,
									taskCount: tasks.length,
								})
							}
							disabled={tasks.length === 0}
						>
							<RocketIcon />
							Publish
						</Button>
					</div>
				)}
			</div>

			{version.changeNote && (
				<p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
					<span className="font-medium">Change note:</span> {version.changeNote}
				</p>
			)}

			{tasks.length === 0 ? (
				<Empty className="border py-12">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ListChecksIcon />
						</EmptyMedia>
						<EmptyTitle>No tasks in this version</EmptyTitle>
						<EmptyDescription>
							Add the steps a worker performs to build one unit. Group them by
							phase, set durations and dependencies, attach drawings.
						</EmptyDescription>
					</EmptyHeader>
					{editable && (
						<EmptyContent className="w-full max-w-md">
							<QuickAddTask
								className="w-full rounded-md border bg-background"
								placeholder="Type a task title and press Enter"
								onAdd={quickAdd(null)}
							/>
							<Button variant="ghost" onClick={() => openTask()}>
								<PlusIcon />
								Add with details
							</Button>
						</EmptyContent>
					)}
				</Empty>
			) : (
				<div className="overflow-hidden rounded-lg border">
					{groups.map((group, groupIndex) => (
						<React.Fragment key={`${group.phase ?? "none"}-${groupIndex}`}>
							<div className="border-b bg-muted/40 px-4 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								{group.phase ?? "No phase"}
							</div>
							{group.items.map((task) => {
								const index = tasks.findIndex((t) => t.id === task.id);
								return (
									<div
										key={task.id}
										className={cn(
											"flex items-start gap-3 border-b px-4 py-3 last:border-b-0",
											"hover:bg-muted/30",
										)}
									>
										<span className="mt-0.5 w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
											{index + 1}
										</span>
										<button
											type="button"
											className="min-w-0 flex-1 text-left"
											onClick={() => openTask(task.id)}
										>
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium">{task.title}</span>
												<span className="text-xs text-muted-foreground">
													{formatEffort(task.durationDays, task.plannedHours)}
												</span>
												{task.requiresPhoto && (
													<Tooltip>
														<TooltipTrigger asChild>
															<CameraIcon className="size-3.5 text-muted-foreground" />
														</TooltipTrigger>
														<TooltipContent>Photo required</TooltipContent>
													</Tooltip>
												)}
												{task.requiresComment && (
													<Tooltip>
														<TooltipTrigger asChild>
															<MessageSquareTextIcon className="size-3.5 text-muted-foreground" />
														</TooltipTrigger>
														<TooltipContent>Comment required</TooltipContent>
													</Tooltip>
												)}
												{task.checklistItems.length > 0 && (
													<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
														<ListChecksIcon className="size-3.5" />
														{task.checklistItems.length}
													</span>
												)}
												{task.documents.length > 0 && (
													<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
														<FileIcon className="size-3.5" />
														{task.documents.length}
													</span>
												)}
											</div>
											{task.dependencies.length > 0 && (
												<p className="mt-0.5 text-xs text-muted-foreground">
													After:{" "}
													{task.dependencies
														.map(
															(dep) =>
																titleById.get(dep.dependsOnTemplateTaskId) ??
																"?",
														)
														.join(", ")}
												</p>
											)}
											{task.instructions && (
												<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
													{task.instructions}
												</p>
											)}
										</button>
										{editable && (
											<div className="flex shrink-0 items-center gap-0.5">
												<Button
													variant="ghost"
													size="icon-xs"
													aria-label="Move up"
													disabled={index === 0 || reorderMutation.isPending}
													onClick={() => move(index, -1)}
												>
													<ArrowUpIcon />
												</Button>
												<Button
													variant="ghost"
													size="icon-xs"
													aria-label="Move down"
													disabled={
														index === tasks.length - 1 ||
														reorderMutation.isPending
													}
													onClick={() => move(index, 1)}
												>
													<ArrowDownIcon />
												</Button>
												<Button
													variant="ghost"
													size="icon-xs"
													aria-label="Remove"
													className="text-muted-foreground hover:text-destructive"
													onClick={() => handleDelete(task)}
												>
													<Trash2Icon />
												</Button>
											</div>
										)}
									</div>
								);
							})}
							{editable && (
								<QuickAddTask
									className="border-b pl-[3.25rem] last:border-b-0"
									onAdd={quickAdd(group.phase)}
									hint={group.phase ? `→ ${group.phase}` : null}
								/>
							)}
						</React.Fragment>
					))}
				</div>
			)}
		</div>
	);
}
