"use client";

import NiceModal from "@ebay/nice-modal-react";
import { formatDistanceToNow } from "date-fns";
import {
	AlertTriangleIcon,
	CameraIcon,
	PencilIcon,
	CheckIcon,
	ChevronDownIcon,
	DownloadIcon,
	FileIcon,
	LockIcon,
	SendIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { ActivityTimeline } from "@/components/manufacturing/activity-timeline";
import { AssigneePicker } from "@/components/manufacturing/assignee-picker";
import { BuildTaskModal } from "@/components/manufacturing/build-task-modal";
import {
	formatDate,
	formatEndDate,
} from "@/components/manufacturing/builds-table";
import {
	TaskStatusBadge,
	taskStatusLabels,
} from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { BlockReasonSheet } from "@/components/work/block-reason-sheet";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useSession } from "@/hooks/use-session";
import {
	BuildTaskStatus,
	BuildTaskStatuses,
	type ChecklistItemStatus,
} from "@/lib/db/schema/enums";
import { formatBytes } from "@/lib/manufacturing/format";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type TaskDetailSheetProps = {
	taskId: string;
	canPlan: boolean;
};

/**
 * Planner-side task detail. Opens as a right-hand sheet from the build page
 * and the assignment grid so a planner can read worker comments, see why a
 * task is blocked, reply, and change status without leaving the overview.
 */
export const TaskDetailSheet = NiceModal.create<TaskDetailSheetProps>(
	({ taskId, canPlan }) => {
		const modal = useEnhancedModal();
		const { user } = useSession();
		const utils = trpc.useUtils();
		const [comment, setComment] = React.useState("");
		const commentRef = React.useRef<HTMLTextAreaElement>(null);

		const query = trpc.organization.work.getTask.useQuery({ id: taskId });
		const task = query.data;

		const invalidate = () => {
			void utils.organization.work.getTask.invalidate({ id: taskId });
			void utils.organization.work.activity.invalidate();
			if (task) {
				void utils.organization.build.get.invalidate({ id: task.buildId });
			}
			void utils.organization.build.list.invalidate();
			void utils.organization.build.assignmentGrid.invalidate();
		};

		const statusMutation = trpc.organization.work.updateStatus.useMutation({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		});
		const checklistMutation =
			trpc.organization.work.updateChecklistItem.useMutation({
				onSuccess: invalidate,
				onError: (error) => toast.error(error.message),
			});
		const commentMutation = trpc.organization.work.addComment.useMutation({
			onSuccess: () => {
				setComment("");
				invalidate();
			},
			onError: (error) => toast.error(error.message),
		});
		const deleteCommentMutation =
			trpc.organization.work.deleteComment.useMutation({
				onSuccess: invalidate,
				onError: (error) => toast.error(error.message),
			});
		const deleteTaskMutation = trpc.organization.build.deleteTask.useMutation({
			onSuccess: () => {
				toast.success("Task deleted");
				invalidate();
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message),
		});

		const openEdit = async () => {
			if (!task) return;
			try {
				const build = await utils.organization.build.get.fetch({
					id: task.buildId,
				});
				void NiceModal.show(BuildTaskModal, {
					buildId: task.buildId,
					siblings: build.tasks.map((t) => ({
						id: t.id,
						title: t.title,
						phase: t.phase,
					})),
					task: {
						id: task.id,
						title: task.title,
						phase: task.phase,
						instructions: task.instructions,
						startDate: task.startDate,
						plannedDurationDays: task.plannedDurationDays,
						requiresPhoto: task.requiresPhoto,
						requiresComment: task.requiresComment,
						dependencies: task.dependencies.map((d) => ({
							dependsOnBuildTaskId: d.dependsOnBuildTaskId,
						})),
					},
				});
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Could not load");
			}
		};

		const confirmDelete = () => {
			if (!task) return;
			void NiceModal.show(ConfirmationModal, {
				title: "Delete task?",
				message: `"${task.title}" will be removed from this unit. Only tasks that have not been started can be deleted.`,
				confirmLabel: "Delete",
				destructive: true,
				onConfirm: async () => {
					await deleteTaskMutation.mutateAsync({ id: task.id });
				},
			});
		};

		const assignMutation = trpc.organization.build.assign.useMutation({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		});
		const unassignMutation = trpc.organization.build.unassign.useMutation({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		});

		const download = async (attachmentId: string) => {
			try {
				const result =
					await utils.organization.work.attachmentDownloadUrl.fetch({
						attachmentId,
					});
				window.open(result.url, "_blank", "noopener");
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Download failed");
			}
		};

		const owners = task
			? task.assignments.filter((assignment) => assignment.role === "owner")
			: [];
		const checklistDone = task
			? task.checklistItems.filter((item) => item.status !== "open").length
			: 0;
		const lastWorkerComment = task
			? [...task.comments].reverse().find((item) => item.authorId !== user?.id)
			: undefined;

		return (
			<Sheet
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<SheetContent className="gap-0 sm:max-w-xl">
					{!task ? (
						<div className="space-y-4 p-6">
							{query.error ? (
								<p className="text-sm text-destructive">
									{query.error.message}
								</p>
							) : (
								<>
									<Skeleton className="h-6 w-2/3" />
									<Skeleton className="h-4 w-1/3" />
									<Skeleton className="h-24 w-full" />
									<Skeleton className="h-24 w-full" />
								</>
							)}
						</div>
					) : (
						<>
							<SheetHeader className="border-b pr-12">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<Link
										href={`/dashboard/organization/builds/${task.build.id}`}
										onClick={modal.dismissForNavigation}
										className="hover:underline"
									>
										{task.build.product.name} · #{task.build.serialNumber}
									</Link>
									{task.phase && (
										<>
											<span>·</span>
											<span>{task.phase}</span>
										</>
									)}
								</div>
								<SheetTitle className="text-base leading-snug">
									{task.title}
								</SheetTitle>
								<SheetDescription className="sr-only">
									Task details, comments and history.
								</SheetDescription>
								<div className="mt-2 flex flex-wrap items-center gap-2">
									{canPlan ? (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													className="rounded-md"
													aria-label="Change status"
												>
													<TaskStatusBadge status={task.status} />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="start">
												{BuildTaskStatuses.map((status) => (
													<DropdownMenuItem
														key={status}
														disabled={
															status === task.status || statusMutation.isPending
														}
														onClick={() => {
															if (status === BuildTaskStatus.blocked) {
																void NiceModal.show(BlockReasonSheet, {
																	taskTitle: task.title,
																	onSubmit: (reason) =>
																		statusMutation.mutateAsync({
																			id: task.id,
																			status,
																			reason,
																		}),
																});
																return;
															}
															statusMutation.mutate({ id: task.id, status });
														}}
													>
														{taskStatusLabels[status]}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									) : (
										<TaskStatusBadge status={task.status} />
									)}
									{task.startDate && task.endDate && (
										<span className="text-xs text-muted-foreground">
											{formatDate(task.startDate)} →{" "}
											{formatEndDate(task.endDate)}
										</span>
									)}
									{task.requiresPhoto && (
										<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
											<CameraIcon className="size-3" /> photo required
										</span>
									)}
									{task.requiresComment && (
										<span className="text-xs text-muted-foreground">
											comment required
										</span>
									)}
									{task.sourceTemplateTaskId === null && (
										<span className="rounded border px-1 text-[10px] leading-4 text-muted-foreground">
											ad-hoc
										</span>
									)}
									{canPlan && (
										<span className="ml-auto flex items-center gap-1">
											<Button
												variant="ghost"
												size="xs"
												onClick={() => void openEdit()}
											>
												<PencilIcon />
												Edit
											</Button>
											<Button
												variant="ghost"
												size="xs"
												className="text-muted-foreground hover:text-destructive"
												disabled={task.status !== BuildTaskStatus.todo}
												onClick={confirmDelete}
											>
												<Trash2Icon />
												Delete
											</Button>
										</span>
									)}
								</div>
							</SheetHeader>

							<div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
								{/* Blocked callout: the thing a planner most wants to see */}
								{task.status === BuildTaskStatus.blocked && (
									<div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
										<div className="flex items-center gap-2 font-medium">
											<AlertTriangleIcon className="size-4 text-amber-600" />
											Blocked by worker
										</div>
										{lastWorkerComment ? (
											<p className="mt-1 whitespace-pre-wrap text-muted-foreground">
												“{lastWorkerComment.body}” —{" "}
												{lastWorkerComment.author?.name ?? "Former member"},{" "}
												{formatDistanceToNow(lastWorkerComment.createdAt, {
													addSuffix: true,
												})}
											</p>
										) : (
											<p className="mt-1 text-muted-foreground">
												No comment left. Ask the assignee below.
											</p>
										)}
									</div>
								)}

								{/* Waiting on dependencies */}
								{task.blockers.length > 0 && (
									<Section title="Waiting on">
										<ul className="space-y-1">
											{task.blockers.map((blocker) => (
												<li key={blocker.id}>
													<button
														type="button"
														className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-muted/60"
														onClick={() => {
															void NiceModal.show(TaskDetailSheet, {
																taskId: blocker.id,
																canPlan,
															});
														}}
													>
														<LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
														<span className="min-w-0 flex-1 truncate">
															{blocker.title}
														</span>
														<TaskStatusBadge status={blocker.status} />
													</button>
												</li>
											))}
										</ul>
									</Section>
								)}

								{/* Assignees */}
								<Section
									title="Assigned to"
									aside={
										canPlan ? (
											<AssigneePicker
												selectedIds={owners.map((a) => a.userId)}
												onSelect={(picked) =>
													assignMutation.mutate({
														buildTaskIds: [task.id],
														userId: picked.id,
														replace: false,
													})
												}
												onDeselect={(picked) =>
													unassignMutation.mutate({
														buildTaskIds: [task.id],
														userId: picked.id,
													})
												}
												disabled={assignMutation.isPending}
												label="Assign"
												buttonProps={{ variant: "ghost", size: "sm" }}
											/>
										) : undefined
									}
								>
									{owners.length === 0 ? (
										<p className="text-sm text-muted-foreground">Unassigned</p>
									) : (
										<ul className="flex flex-wrap gap-2">
											{owners.map((assignment) => (
												<li
													key={assignment.id}
													className="flex items-center gap-2 rounded-full border py-1 pr-2 pl-1 text-sm"
												>
													<UserAvatar
														name={assignment.user.name}
														src={assignment.user.image}
														className="size-6"
														fallbackClassName="text-[10px]"
													/>
													{assignment.user.name}
													{canPlan && (
														<button
															type="button"
															aria-label={`Unassign ${assignment.user.name}`}
															className="text-muted-foreground hover:text-destructive"
															onClick={() =>
																unassignMutation.mutate({
																	buildTaskIds: [task.id],
																	userId: assignment.userId,
																})
															}
														>
															<XIcon className="size-3.5" />
														</button>
													)}
												</li>
											))}
										</ul>
									)}
								</Section>

								{/* Instructions */}
								{task.instructions && (
									<Section title="Instructions">
										<p className="text-sm whitespace-pre-wrap">
											{task.instructions}
										</p>
									</Section>
								)}

								{/* Checklist */}
								{task.checklistItems.length > 0 && (
									<Section
										title="Checklist"
										aside={`${checklistDone}/${task.checklistItems.length}`}
									>
										<ul className="space-y-1">
											{task.checklistItems.map((item) => {
												const done = item.status !== "open";
												const next: ChecklistItemStatus = done
													? "open"
													: "done";
												return (
													<li key={item.id}>
														<button
															type="button"
															disabled={!canPlan || checklistMutation.isPending}
															onClick={() =>
																checklistMutation.mutate({
																	id: item.id,
																	status: next,
																})
															}
															className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left text-sm enabled:hover:bg-muted/60 disabled:cursor-default"
														>
															<span
																className={cn(
																	"mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
																	done
																		? "border-emerald-500 bg-emerald-500 text-white"
																		: "border-muted-foreground/40",
																)}
															>
																{done && <CheckIcon className="size-3" />}
															</span>
															<span className="min-w-0 flex-1">
																<span
																	className={cn(
																		"block",
																		done &&
																			"text-muted-foreground line-through",
																	)}
																>
																	{item.title}
																</span>
																{done && item.completedBy && (
																	<span className="block text-xs text-muted-foreground">
																		{item.completedBy.name}
																	</span>
																)}
															</span>
														</button>
													</li>
												);
											})}
										</ul>
									</Section>
								)}

								{/* Documents */}
								{task.documents.length > 0 && (
									<Section title="Documents">
										<ul className="divide-y">
											{task.documents.map((doc) => (
												<li key={doc.id}>
													<button
														type="button"
														onClick={() => download(doc.id)}
														className="flex w-full items-center gap-3 px-1 py-2 text-left text-sm hover:bg-muted/60"
													>
														<FileIcon className="size-4 shrink-0 text-muted-foreground" />
														<span className="min-w-0 flex-1">
															<span className="block truncate">
																{doc.fileName}
															</span>
															<span className="block text-xs text-muted-foreground">
																{formatBytes(doc.sizeBytes ?? 0)}
															</span>
														</span>
														<DownloadIcon className="size-4 text-muted-foreground" />
													</button>
												</li>
											))}
										</ul>
									</Section>
								)}

								{/* Worker uploads */}
								{task.uploads.length > 0 && (
									<Section title="Photos from the floor">
										<ul className="divide-y">
											{task.uploads.map((upload) => (
												<li key={upload.id}>
													<button
														type="button"
														onClick={() => download(upload.id)}
														className="flex w-full items-center gap-3 px-1 py-2 text-left text-sm hover:bg-muted/60"
													>
														<CameraIcon className="size-4 shrink-0 text-muted-foreground" />
														<span className="min-w-0 flex-1">
															<span className="block truncate">
																{upload.fileName}
															</span>
															<span className="block text-xs text-muted-foreground">
																{upload.uploadedBy?.name ?? "Unknown"} ·{" "}
																{formatDistanceToNow(upload.createdAt, {
																	addSuffix: true,
																})}{" "}
																· {formatBytes(upload.sizeBytes ?? 0)}
															</span>
														</span>
														<DownloadIcon className="size-4 text-muted-foreground" />
													</button>
												</li>
											))}
										</ul>
									</Section>
								)}

								{/* Comments */}
								<Section title="Comments" aside={String(task.comments.length)}>
									{task.comments.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No comments yet.
										</p>
									) : (
										<ul className="space-y-3">
											{task.comments.map((item) => (
												<li key={item.id} className="flex gap-3">
													<UserAvatar
														name={item.author?.name ?? "?"}
														src={item.author?.image}
														className="size-7"
														fallbackClassName="text-xs"
													/>
													<div className="min-w-0 flex-1">
														<div className="flex items-baseline gap-2">
															<span className="text-sm font-medium">
																{item.author?.name ?? "Former member"}
															</span>
															<span className="text-xs text-muted-foreground">
																{formatDistanceToNow(item.createdAt, {
																	addSuffix: true,
																})}
															</span>
															{(item.authorId === user?.id || canPlan) && (
																<button
																	type="button"
																	className="ml-auto text-muted-foreground hover:text-destructive"
																	aria-label="Delete comment"
																	disabled={deleteCommentMutation.isPending}
																	onClick={() =>
																		deleteCommentMutation.mutate({
																			id: item.id,
																		})
																	}
																>
																	<Trash2Icon className="size-3.5" />
																</button>
															)}
														</div>
														<p className="text-sm whitespace-pre-wrap">
															{item.body}
														</p>
													</div>
												</li>
											))}
										</ul>
									)}
								</Section>

								{/* History */}
								<details className="group rounded-lg border">
									<summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold select-none">
										History
										<ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
									</summary>
									<div className="border-t px-3 py-3">
										<ActivityTimeline
											buildTaskId={task.id}
											limit={30}
											compact
										/>
									</div>
								</details>
							</div>

							{/* Reply box pinned to the bottom */}
							<form
								className="flex items-end gap-2 border-t px-6 py-4"
								onSubmit={(event) => {
									event.preventDefault();
									const body = comment.trim();
									if (!body) return;
									commentMutation.mutate({ buildTaskId: task.id, body });
								}}
							>
								<Textarea
									ref={commentRef}
									value={comment}
									onChange={(event) => setComment(event.target.value)}
									placeholder={
										owners.length > 0
											? `Reply to ${owners.map((a) => a.user.name).join(", ")}…`
											: "Write a comment…"
									}
									rows={2}
									className="min-h-0 flex-1 resize-none"
									onKeyDown={(event) => {
										if (
											(event.metaKey || event.ctrlKey) &&
											event.key === "Enter"
										) {
											event.currentTarget.form?.requestSubmit();
										}
									}}
								/>
								<Button
									type="submit"
									size="icon"
									aria-label="Send comment"
									disabled={!comment.trim() || commentMutation.isPending}
								>
									<SendIcon className="size-4" />
								</Button>
							</form>
						</>
					)}
				</SheetContent>
			</Sheet>
		);
	},
);

function Section({
	title,
	aside,
	children,
}: React.PropsWithChildren<{ title: string; aside?: React.ReactNode }>) {
	return (
		<section>
			<div className="mb-1.5 flex items-center justify-between">
				<h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					{title}
				</h3>
				{aside && (
					<span className="text-xs text-muted-foreground">{aside}</span>
				)}
			</div>
			{children}
		</section>
	);
}

export function openTaskDetail(taskId: string, canPlan: boolean): void {
	void NiceModal.show(TaskDetailSheet, { taskId, canPlan });
}
