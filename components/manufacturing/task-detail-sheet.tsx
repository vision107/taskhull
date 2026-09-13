"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	addDays,
	differenceInCalendarDays,
	format,
	formatDistanceToNow,
	parseISO,
} from "date-fns";
import {
	AlertTriangleIcon,
	CameraIcon,
	CheckIcon,
	ChevronRightIcon,
	DownloadIcon,
	FileIcon,
	ListTreeIcon,
	LockIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RotateCcwIcon,
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
import { QuickAddTask } from "@/components/manufacturing/quick-add-task";
import {
	TaskStatusBadge,
	taskStatusLabels,
} from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/custom/date-picker";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user/user-avatar";
import { BlockReasonSheet } from "@/components/work/block-reason-sheet";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useSession } from "@/hooks/use-session";
import {
	BuildTaskStatus,
	BuildTaskStatuses,
	type ChecklistItemStatus,
} from "@/lib/db/schema/enums";
import { formatBytes, formatHours } from "@/lib/manufacturing/format";
import {
	DOCUMENT_ACCEPT,
	normalizeContentType,
	UPLOAD_LIMITS,
	uploadRejection,
} from "@/lib/manufacturing/uploads";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type TaskDetailSheetProps = {
	taskId: string;
	canPlan: boolean;
};

const ISO = "yyyy-MM-dd";

/** Scheduled end dates are exclusive; the due date is the last working day. */
function dueFromEnd(endDate: string | null): Date | undefined {
	return endDate ? addDays(parseISO(endDate), -1) : undefined;
}

/**
 * Planner-side task detail, laid out like a task pane in a project tool:
 * everything is edited in place. Opens as a right-hand sheet from the
 * project page and the assignment grid.
 */
export const TaskDetailSheet = NiceModal.create<TaskDetailSheetProps>(
	({ taskId, canPlan }) => {
		const modal = useEnhancedModal();
		const { user } = useSession();
		const utils = trpc.useUtils();
		const [comment, setComment] = React.useState("");
		const [feedTab, setFeedTab] = React.useState<"comments" | "activity">(
			"comments",
		);
		const commentRef = React.useRef<HTMLTextAreaElement>(null);

		const query = trpc.organization.work.getTask.useQuery({ id: taskId });
		const task = query.data;

		// Sibling tasks for the "depends on" picker (cached from the project page).
		const { data: build } = trpc.organization.build.get.useQuery(
			{ id: task?.buildId ?? "" },
			{ enabled: Boolean(task) && canPlan },
		);

		const invalidate = () => {
			void utils.organization.work.getTask.invalidate({ id: taskId });
			void utils.organization.work.activity.invalidate();
			if (task) {
				void utils.organization.build.get.invalidate({ id: task.buildId });
			}
			void utils.organization.build.list.invalidate();
			void utils.organization.build.assignmentGrid.invalidate();
		};

		const onError = (error: { message: string }) => toast.error(error.message);

		const updateMutation = trpc.organization.build.updateTask.useMutation({
			onSuccess: invalidate,
			onError,
		});
		const statusMutation = trpc.organization.work.updateStatus.useMutation({
			onSuccess: invalidate,
			onError,
		});
		const checklistMutation =
			trpc.organization.work.updateChecklistItem.useMutation({
				onSuccess: invalidate,
				onError,
			});
		const commentMutation = trpc.organization.work.addComment.useMutation({
			onSuccess: () => {
				setComment("");
				invalidate();
			},
			onError,
		});
		const deleteCommentMutation =
			trpc.organization.work.deleteComment.useMutation({
				onSuccess: invalidate,
				onError,
			});
		const deleteTaskMutation = trpc.organization.build.deleteTask.useMutation({
			onSuccess: () => {
				toast.success("Task deleted");
				invalidate();
				modal.handleClose();
			},
			onError,
		});
		const assignMutation = trpc.organization.build.assign.useMutation({
			onSuccess: invalidate,
			onError,
		});
		const unassignMutation = trpc.organization.build.unassign.useMutation({
			onSuccess: invalidate,
			onError,
		});
		const documentUrlMutation =
			trpc.organization.build.taskDocumentUploadUrl.useMutation();
		const addDocumentMutation =
			trpc.organization.build.addTaskDocument.useMutation({
				onSuccess: invalidate,
				onError,
			});
		const removeDocumentMutation =
			trpc.organization.build.removeTaskDocument.useMutation({
				onSuccess: invalidate,
				onError,
			});
		const addChecklistItemMutation =
			trpc.organization.build.addChecklistItem.useMutation({
				onSuccess: invalidate,
				onError,
			});
		const removeChecklistItemMutation =
			trpc.organization.build.removeChecklistItem.useMutation({
				onSuccess: invalidate,
				onError,
			});
		const addSubtaskMutation = trpc.organization.build.createTask.useMutation({
			onSuccess: invalidate,
			onError,
		});

		const update = (
			patch: Omit<Parameters<typeof updateMutation.mutate>[0], "id">,
		) => {
			if (!task) return;
			updateMutation.mutate({ id: task.id, ...patch });
		};

		const setStatus = (status: BuildTaskStatus) => {
			if (!task) return;
			if (status === BuildTaskStatus.blocked) {
				void NiceModal.show(BlockReasonSheet, {
					taskTitle: task.title,
					onSubmit: (reason) =>
						statusMutation.mutateAsync({ id: task.id, status, reason }),
				});
				return;
			}
			statusMutation.mutate({ id: task.id, status });
		};

		const confirmDelete = () => {
			if (!task) return;
			void NiceModal.show(ConfirmationModal, {
				title: "Delete task?",
				message:
					task.subtasks.length > 0
						? `"${task.title}" and its ${task.subtasks.length} ${task.subtasks.length === 1 ? "subtask" : "subtasks"} will be removed from this unit. Only tasks that have not been started can be deleted.`
						: `"${task.title}" will be removed from this unit. Only tasks that have not been started can be deleted.`,
				confirmLabel: "Delete",
				destructive: true,
				onConfirm: async () => {
					await deleteTaskMutation.mutateAsync({ id: task.id });
				},
			});
		};

		const [uploadingDocs, setUploadingDocs] = React.useState(false);
		const docInputRef = React.useRef<HTMLInputElement>(null);
		const handleDocumentFiles = async (files: FileList | null) => {
			if (!files || files.length === 0) return;
			setUploadingDocs(true);
			try {
				for (const file of Array.from(files)) {
					const rejection = uploadRejection("document", {
						fileName: file.name,
						contentType: file.type,
						sizeBytes: file.size,
					});
					if (rejection) {
						toast.error(`${file.name}: ${rejection}`);
						continue;
					}
					const contentType = normalizeContentType(file.type);
					const { storageKey, signedUrl } =
						await documentUrlMutation.mutateAsync({
							buildTaskId: taskId,
							fileName: file.name,
							contentType,
							sizeBytes: file.size,
						});
					const response = await fetch(signedUrl, {
						method: "PUT",
						body: file,
						headers: { "Content-Type": contentType },
					});
					if (!response.ok) throw new Error(`Upload of ${file.name} failed`);
					await addDocumentMutation.mutateAsync({
						buildTaskId: taskId,
						storageKey,
						fileName: file.name,
						contentType,
						sizeBytes: file.size,
					});
				}
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Upload failed. Is storage configured?",
				);
			} finally {
				setUploadingDocs(false);
				if (docInputRef.current) docInputRef.current.value = "";
			}
		};

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
		const subtasksDone = task
			? task.subtasks.filter(
					(subtask) => subtask.status === BuildTaskStatus.done,
				).length
			: 0;
		const openSubtasks = task ? task.subtasks.length - subtasksDone : 0;
		const lastWorkerComment = task
			? [...task.comments].reverse().find((item) => item.authorId !== user?.id)
			: undefined;
		const isDone = task?.status === BuildTaskStatus.done;
		const completeBlockedBy =
			task && !isDone
				? task.blockers.length > 0
					? `Waiting on "${task.blockers[0]!.title}"`
					: openSubtasks > 0
						? `${openSubtasks} ${openSubtasks === 1 ? "subtask is" : "subtasks are"} still open`
						: null
				: null;

		// Due date edits keep the start and resize; if the due date moves before
		// the start, the task moves there as a one-day task.
		const onDueChange = (date?: Date) => {
			if (!(date && task)) return;
			const due = format(date, ISO);
			if (task.startDate && due >= task.startDate) {
				update({
					plannedDurationDays:
						differenceInCalendarDays(date, parseISO(task.startDate)) + 1,
				});
			} else {
				update({ startDate: due, plannedDurationDays: 1 });
			}
		};
		// Start date edits keep the duration and shift the task.
		const onStartChange = (date?: Date) => {
			if (!date) return;
			update({ startDate: format(date, ISO) });
		};

		const dependencyCandidates = (build?.tasks ?? []).filter(
			(t) => t.id !== task?.id && t.parentTaskId !== task?.id,
		);
		const dependsOnIds = task
			? task.dependencies.map((dep) => dep.dependsOnBuildTaskId)
			: [];

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
							{/* Toolbar */}
							<div className="flex items-center gap-2 border-b px-4 py-2.5 pr-12">
								{canPlan ? (
									<Tooltip>
										<TooltipTrigger asChild>
											<span>
												<Button
													variant={isDone ? "default" : "outline"}
													size="sm"
													disabled={
														statusMutation.isPending ||
														Boolean(completeBlockedBy)
													}
													className={cn(
														isDone &&
															"bg-emerald-600 text-white hover:bg-emerald-600/90",
													)}
													onClick={() =>
														setStatus(
															isDone
																? BuildTaskStatus.inProgress
																: BuildTaskStatus.done,
														)
													}
												>
													{isDone ? <RotateCcwIcon /> : <CheckIcon />}
													{isDone ? "Completed" : "Mark complete"}
												</Button>
											</span>
										</TooltipTrigger>
										{completeBlockedBy && (
											<TooltipContent>{completeBlockedBy}</TooltipContent>
										)}
									</Tooltip>
								) : null}
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
													onClick={() => setStatus(status)}
												>
													{taskStatusLabels[status]}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
								) : (
									<TaskStatusBadge status={task.status} />
								)}
								<span className="ml-auto flex items-center gap-1">
									{canPlan && (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon-sm"
													aria-label="More actions"
												>
													<MoreHorizontalIcon />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													variant="destructive"
													disabled={task.status !== BuildTaskStatus.todo}
													onClick={confirmDelete}
												>
													<Trash2Icon />
													Delete task
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</span>
							</div>

							{/* Blocked callout: the thing a planner most wants to see */}
							{task.status === BuildTaskStatus.blocked && (
								<div className="flex items-start gap-2 border-b bg-amber-500/10 px-6 py-2.5 text-sm">
									<AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
									<div className="min-w-0">
										<span className="font-medium">Blocked by worker.</span>{" "}
										{lastWorkerComment ? (
											<span className="text-muted-foreground">
												“{lastWorkerComment.body}” —{" "}
												{lastWorkerComment.author?.name ?? "Former member"},{" "}
												{formatDistanceToNow(lastWorkerComment.createdAt, {
													addSuffix: true,
												})}
											</span>
										) : (
											<span className="text-muted-foreground">
												No comment left. Ask the assignee below.
											</span>
										)}
									</div>
								</div>
							)}

							<div className="flex-1 overflow-y-auto">
								<div className="space-y-6 px-6 pt-5 pb-6">
									{/* Breadcrumb + title */}
									<div>
										<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
											<Link
												href={`/dashboard/organization/projects/${task.build.id}`}
												onClick={modal.dismissForNavigation}
												className="truncate hover:underline"
											>
												{task.build.templateVersion?.template.name ??
													task.build.name ??
													"Project"}{" "}
												· #{task.build.serialNumber}
											</Link>
											{task.parent && (
												<>
													<ChevronRightIcon className="size-3 shrink-0" />
													<button
														type="button"
														className="inline-flex min-w-0 items-center gap-1 truncate hover:underline"
														onClick={() => {
															void NiceModal.show(TaskDetailSheet, {
																taskId: task.parent!.id,
																canPlan,
															});
														}}
													>
														<ListTreeIcon className="size-3 shrink-0" />
														<span className="truncate">
															{task.parent.title}
														</span>
													</button>
												</>
											)}
											{task.sourceTemplateTaskId === null && (
												<span className="ml-1 rounded border px-1 text-[10px] leading-4">
													ad-hoc
												</span>
											)}
										</div>
										<SheetTitle className="sr-only">{task.title}</SheetTitle>
										<SheetDescription className="sr-only">
											Task details, comments and history.
										</SheetDescription>
										<InlineTitle
											key={`${task.id}:${task.title}`}
											value={task.title}
											readOnly={!canPlan}
											done={isDone}
											onSave={(title) => update({ title })}
										/>
									</div>

									{/* Fields */}
									<dl className="space-y-1">
										<FieldRow label="Assignee">
											<div className="flex flex-wrap items-center gap-1.5">
												{owners.map((assignment) => (
													<span
														key={assignment.id}
														className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-1.5 pl-0.5 text-sm"
													>
														<UserAvatar
															name={assignment.user.name}
															src={assignment.user.image}
															className="size-5"
															fallbackClassName="text-[9px]"
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
													</span>
												))}
												{canPlan ? (
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
														label={owners.length === 0 ? "Assign" : ""}
														buttonProps={{
															variant: "ghost",
															size: owners.length === 0 ? "sm" : "icon-xs",
															className:
																owners.length === 0
																	? "-ml-2 text-muted-foreground"
																	: "text-muted-foreground",
															"aria-label": "Add assignee",
														}}
													/>
												) : owners.length === 0 ? (
													<Muted>Unassigned</Muted>
												) : null}
											</div>
										</FieldRow>

										<FieldRow label="Due date">
											{canPlan ? (
												<DatePicker
													variant="ghost"
													size="sm"
													className="-ml-2 font-normal"
													dateFormat="EEE, d MMM"
													placeholder="No due date"
													date={dueFromEnd(task.endDate)}
													onDateChange={onDueChange}
													disabled={updateMutation.isPending}
												/>
											) : (
												<Value>
													{task.endDate
														? format(dueFromEnd(task.endDate)!, "EEE, d MMM")
														: "–"}
												</Value>
											)}
										</FieldRow>

										<FieldRow label="Start date">
											{canPlan ? (
												<DatePicker
													variant="ghost"
													size="sm"
													className="-ml-2 font-normal"
													dateFormat="EEE, d MMM"
													placeholder="No start date"
													date={
														task.startDate
															? parseISO(task.startDate)
															: undefined
													}
													onDateChange={onStartChange}
													disabled={updateMutation.isPending}
												/>
											) : (
												<Value>
													{task.startDate
														? format(parseISO(task.startDate), "EEE, d MMM")
														: "–"}
												</Value>
											)}
										</FieldRow>

										<FieldRow label="Duration">
											<div className="flex items-center gap-3 text-sm">
												<InlineNumber
													key={`d:${task.id}:${task.plannedDurationDays}`}
													value={task.plannedDurationDays}
													unit={task.plannedDurationDays === 1 ? "day" : "days"}
													min={0}
													max={365}
													step={1}
													readOnly={!canPlan}
													aria-label="Duration in days"
													onSave={(days) =>
														update({
															plannedDurationDays: Math.round(days ?? 1),
														})
													}
												/>
												<span className="text-muted-foreground">·</span>
												<InlineNumber
													key={`h:${task.id}:${task.plannedHours ?? ""}`}
													value={task.plannedHours}
													unit="h effort"
													placeholder="–"
													min={0}
													max={10_000}
													step={0.5}
													readOnly={!canPlan}
													aria-label="Effort in hours"
													formatValue={(hours) =>
														formatHours(hours).slice(0, -1)
													}
													onSave={(hours) => update({ plannedHours: hours })}
												/>
											</div>
										</FieldRow>

										<FieldRow label="Phase">
											<InlineText
												key={`p:${task.id}:${task.phase ?? ""}`}
												value={task.phase ?? ""}
												placeholder="No phase"
												readOnly={!canPlan}
												aria-label="Phase"
												list={
													build
														? Array.from(
																new Set(
																	build.tasks
																		.map((t) => t.phase)
																		.filter((p): p is string => Boolean(p)),
																),
															)
														: []
												}
												onSave={(phase) => update({ phase: phase || null })}
											/>
										</FieldRow>

										<FieldRow label="Depends on">
											<div className="flex flex-wrap items-center gap-1.5">
												{task.dependencies.map((dep) => {
													const open =
														dep.dependsOn.status !== BuildTaskStatus.done;
													return (
														<button
															key={dep.dependsOnBuildTaskId}
															type="button"
															className={cn(
																"inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-sm hover:bg-muted/60",
																open && "border-amber-500/50",
															)}
															onClick={() => {
																void NiceModal.show(TaskDetailSheet, {
																	taskId: dep.dependsOnBuildTaskId,
																	canPlan,
																});
															}}
														>
															{open && (
																<LockIcon className="size-3 shrink-0 text-amber-600" />
															)}
															<span className="truncate">
																{dep.dependsOn.title}
															</span>
														</button>
													);
												})}
												{canPlan ? (
													<Popover>
														<PopoverTrigger asChild>
															<Button
																variant="ghost"
																size={
																	task.dependencies.length === 0
																		? "sm"
																		: "icon-xs"
																}
																className={cn(
																	"text-muted-foreground",
																	task.dependencies.length === 0 && "-ml-2",
																)}
																aria-label="Edit dependencies"
																disabled={dependencyCandidates.length === 0}
															>
																<PlusIcon />
																{task.dependencies.length === 0 &&
																	"Add dependency"}
															</Button>
														</PopoverTrigger>
														<PopoverContent align="start" className="w-72 p-2">
															<p className="px-1 pb-1 text-xs text-muted-foreground">
																Can only start after…
															</p>
															<div className="max-h-64 space-y-0.5 overflow-y-auto">
																{dependencyCandidates.map((sibling) => {
																	const checked = dependsOnIds.includes(
																		sibling.id,
																	);
																	return (
																		<label
																			key={sibling.id}
																			className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/60"
																		>
																			<Checkbox
																				checked={checked}
																				disabled={updateMutation.isPending}
																				onCheckedChange={(next) => {
																					const set = new Set(dependsOnIds);
																					if (next === true)
																						set.add(sibling.id);
																					else set.delete(sibling.id);
																					update({
																						dependsOnIds: Array.from(set),
																					});
																				}}
																			/>
																			<span className="min-w-0 flex-1 truncate">
																				{sibling.parentTaskId && (
																					<span className="text-muted-foreground">
																						{
																							build?.tasks.find(
																								(t) =>
																									t.id === sibling.parentTaskId,
																							)?.title
																						}{" "}
																						›{" "}
																					</span>
																				)}
																				{sibling.title}
																			</span>
																			{sibling.phase && (
																				<span className="shrink-0 text-xs text-muted-foreground">
																					{sibling.phase}
																				</span>
																			)}
																		</label>
																	);
																})}
															</div>
														</PopoverContent>
													</Popover>
												) : task.dependencies.length === 0 ? (
													<Muted>None</Muted>
												) : null}
											</div>
										</FieldRow>

										<FieldRow label="Requires">
											<div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
												<span className="inline-flex items-center gap-2">
													<Switch
														size="sm"
														aria-label="Photo required"
														checked={task.requiresPhoto}
														disabled={!canPlan || updateMutation.isPending}
														onCheckedChange={(checked) =>
															update({ requiresPhoto: checked })
														}
													/>
													<CameraIcon className="size-3.5 text-muted-foreground" />
													Photo
												</span>
												<span className="inline-flex items-center gap-2">
													<Switch
														size="sm"
														aria-label="Comment required"
														checked={task.requiresComment}
														disabled={!canPlan || updateMutation.isPending}
														onCheckedChange={(checked) =>
															update({ requiresComment: checked })
														}
													/>
													Comment
												</span>
											</div>
										</FieldRow>
									</dl>

									{/* Description */}
									<Section title="Description">
										<InlineDescription
											key={`i:${task.id}:${task.instructions ?? ""}`}
											value={task.instructions ?? ""}
											readOnly={!canPlan}
											onSave={(instructions) =>
												update({ instructions: instructions || null })
											}
										/>
									</Section>

									{/* Subtasks: independent tasks under this one */}
									{(task.subtasks.length > 0 ||
										(canPlan && !task.parentTaskId)) && (
										<Section
											title="Subtasks"
											count={
												task.subtasks.length > 0
													? `${subtasksDone}/${task.subtasks.length}`
													: undefined
											}
										>
											{task.subtasks.length > 0 && (
												<ul className="divide-y border-y">
													{task.subtasks.map((subtask) => {
														const subOwners = subtask.assignments.filter(
															(assignment) => assignment.role === "owner",
														);
														const subDone =
															subtask.status === BuildTaskStatus.done;
														return (
															<li key={subtask.id}>
																<button
																	type="button"
																	className="flex w-full items-center gap-2 py-1.5 text-left text-sm hover:bg-muted/40"
																	onClick={() => {
																		void NiceModal.show(TaskDetailSheet, {
																			taskId: subtask.id,
																			canPlan,
																		});
																	}}
																>
																	<span
																		className={cn(
																			"flex size-4 shrink-0 items-center justify-center rounded-full border",
																			subDone
																				? "border-emerald-500 bg-emerald-500 text-white"
																				: "border-muted-foreground/40",
																		)}
																	>
																		{subDone && (
																			<CheckIcon className="size-3" />
																		)}
																	</span>
																	<span
																		className={cn(
																			"min-w-0 flex-1 truncate",
																			subDone &&
																				"text-muted-foreground line-through",
																		)}
																	>
																		{subtask.title}
																	</span>
																	{subtask.endDate && (
																		<span className="shrink-0 text-xs text-muted-foreground">
																			{format(
																				dueFromEnd(subtask.endDate)!,
																				"d MMM",
																			)}
																		</span>
																	)}
																	{subOwners.length > 0 && (
																		<span className="flex shrink-0 -space-x-1.5">
																			{subOwners.map((assignment) => (
																				<UserAvatar
																					key={assignment.id}
																					name={assignment.user.name}
																					src={assignment.user.image}
																					className="size-5 ring-1 ring-background"
																					fallbackClassName="text-[9px]"
																				/>
																			))}
																		</span>
																	)}
																	<TaskStatusBadge status={subtask.status} />
																</button>
															</li>
														);
													})}
												</ul>
											)}
											{canPlan && !task.parentTaskId && (
												<QuickAddTask
													className="-mx-1 rounded-md px-1"
													placeholder="Add subtask and press Enter"
													onAdd={(title) =>
														addSubtaskMutation.mutateAsync({
															buildId: task.buildId,
															title,
															parentTaskId: task.id,
														})
													}
												/>
											)}
										</Section>
									)}

									{/* Checklist */}
									{(task.checklistItems.length > 0 || canPlan) && (
										<Section
											title="Checklist"
											count={
												task.checklistItems.length > 0
													? `${checklistDone}/${task.checklistItems.length}`
													: undefined
											}
										>
											{task.checklistItems.length > 0 && (
												<ul className="divide-y border-y">
													{task.checklistItems.map((item) => {
														const done = item.status !== "open";
														const next: ChecklistItemStatus = done
															? "open"
															: "done";
														return (
															<li
																key={item.id}
																className="flex items-center gap-1"
															>
																<button
																	type="button"
																	disabled={
																		!canPlan || checklistMutation.isPending
																	}
																	onClick={() =>
																		checklistMutation.mutate({
																			id: item.id,
																			status: next,
																		})
																	}
																	className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm enabled:hover:bg-muted/40 disabled:cursor-default"
																>
																	<span
																		className={cn(
																			"flex size-4 shrink-0 items-center justify-center rounded border",
																			done
																				? "border-emerald-500 bg-emerald-500 text-white"
																				: "border-muted-foreground/40",
																		)}
																	>
																		{done && <CheckIcon className="size-3" />}
																	</span>
																	<span
																		className={cn(
																			"min-w-0 flex-1 truncate",
																			done &&
																				"text-muted-foreground line-through",
																		)}
																	>
																		{item.title}
																	</span>
																	{done && item.completedBy && (
																		<span className="shrink-0 text-xs text-muted-foreground">
																			{item.completedBy.name}
																		</span>
																	)}
																</button>
																{canPlan && (
																	<Button
																		variant="ghost"
																		size="icon-xs"
																		aria-label="Remove checklist item"
																		className="shrink-0 text-muted-foreground hover:text-destructive"
																		disabled={
																			removeChecklistItemMutation.isPending
																		}
																		onClick={() =>
																			removeChecklistItemMutation.mutate({
																				id: item.id,
																			})
																		}
																	>
																		<XIcon />
																	</Button>
																)}
															</li>
														);
													})}
												</ul>
											)}
											{canPlan && (
												<QuickAddTask
													className="-mx-1 rounded-md px-1"
													placeholder="Add checklist item and press Enter"
													onAdd={(title) =>
														addChecklistItemMutation.mutateAsync({
															buildTaskId: task.id,
															title,
														})
													}
												/>
											)}
										</Section>
									)}

									{/* Attachments: planner documents + worker photos */}
									{(task.documents.length > 0 ||
										task.uploads.length > 0 ||
										canPlan) && (
										<Section
											title="Attachments"
											action={
												canPlan ? (
													<>
														<input
															ref={docInputRef}
															type="file"
															multiple
															accept={DOCUMENT_ACCEPT}
															className="hidden"
															aria-label="Add documents"
															onChange={(event) =>
																void handleDocumentFiles(event.target.files)
															}
														/>
														<Button
															type="button"
															variant="ghost"
															size="icon-xs"
															aria-label="Add documents"
															className="text-muted-foreground"
															disabled={uploadingDocs}
															loading={uploadingDocs}
															onClick={() => docInputRef.current?.click()}
														>
															<PlusIcon />
														</Button>
													</>
												) : undefined
											}
										>
											{task.documents.length === 0 &&
											task.uploads.length === 0 ? (
												<Muted>
													Drawings, PDFs or images for the worker (max{" "}
													{UPLOAD_LIMITS.document.label} each). Photos taken on
													the floor show up here too.
												</Muted>
											) : (
												<ul className="divide-y border-y">
													{task.documents.map((doc) => (
														<li key={doc.id} className="flex items-center">
															<button
																type="button"
																onClick={() => download(doc.id)}
																className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left text-sm hover:bg-muted/40"
															>
																<FileIcon className="size-4 shrink-0 text-muted-foreground" />
																<span className="min-w-0 flex-1">
																	<span className="block truncate">
																		{doc.fileName}
																	</span>
																	<span className="block text-xs text-muted-foreground">
																		{formatBytes(doc.sizeBytes ?? 0)}
																		{doc.templateDocumentId
																			? " · from template"
																			: ""}
																	</span>
																</span>
																<DownloadIcon className="size-4 text-muted-foreground" />
															</button>
															{canPlan && (
																<Button
																	type="button"
																	variant="ghost"
																	size="icon-xs"
																	aria-label="Remove document"
																	className="text-muted-foreground hover:text-destructive"
																	disabled={removeDocumentMutation.isPending}
																	onClick={() =>
																		removeDocumentMutation.mutate({
																			id: doc.id,
																		})
																	}
																>
																	<Trash2Icon />
																</Button>
															)}
														</li>
													))}
													{task.uploads.map((upload) => (
														<li key={upload.id}>
															<button
																type="button"
																onClick={() => download(upload.id)}
																className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-muted/40"
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
											)}
										</Section>
									)}

									{/* Feed: comments or everything */}
									<section>
										<div className="mb-3 flex items-center gap-1 rounded-lg bg-muted/60 p-0.5 text-sm">
											{(
												[
													["comments", `Comments (${task.comments.length})`],
													["activity", "All activity"],
												] as const
											).map(([value, label]) => (
												<button
													key={value}
													type="button"
													className={cn(
														"flex-1 rounded-md px-2 py-1 transition-colors",
														feedTab === value
															? "bg-background font-medium shadow-xs"
															: "text-muted-foreground hover:text-foreground",
													)}
													onClick={() => setFeedTab(value)}
												>
													{label}
												</button>
											))}
										</div>
										{feedTab === "comments" ? (
											task.comments.length === 0 ? (
												<Muted>No comments yet.</Muted>
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
											)
										) : (
											<ActivityTimeline
												buildTaskId={task.id}
												limit={50}
												compact
											/>
										)}
									</section>
								</div>
							</div>

							{/* Comment box pinned to the bottom */}
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
											: "Add a comment…"
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

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function FieldRow({
	label,
	children,
}: React.PropsWithChildren<{ label: string }>) {
	return (
		<div className="flex min-h-8 items-center gap-3">
			<dt className="w-24 shrink-0 text-sm text-muted-foreground">{label}</dt>
			<dd className="min-w-0 flex-1">{children}</dd>
		</div>
	);
}

function Section({
	title,
	count,
	action,
	children,
}: React.PropsWithChildren<{
	title: string;
	count?: string;
	action?: React.ReactNode;
}>) {
	return (
		<section>
			<div className="mb-1.5 flex items-center gap-2">
				<h3 className="text-sm font-semibold">{title}</h3>
				{count && (
					<span className="rounded bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
						{count}
					</span>
				)}
				{action}
			</div>
			{children}
		</section>
	);
}

function Muted({ children }: React.PropsWithChildren) {
	return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Value({ children }: React.PropsWithChildren) {
	return <span className="text-sm">{children}</span>;
}

// ---------------------------------------------------------------------------
// Inline editors: save on blur / Enter, Escape reverts
// ---------------------------------------------------------------------------

function InlineTitle({
	value,
	readOnly,
	done,
	onSave,
}: {
	value: string;
	readOnly: boolean;
	done: boolean;
	onSave: (value: string) => void;
}) {
	const [draft, setDraft] = React.useState(value);
	const commit = () => {
		const next = draft.trim();
		if (!next) {
			setDraft(value);
			return;
		}
		if (next !== value) onSave(next);
	};
	if (readOnly) {
		return (
			<h2
				className={cn(
					"mt-1 text-xl leading-snug font-semibold",
					done && "text-muted-foreground line-through",
				)}
			>
				{value}
			</h2>
		);
	}
	return (
		<textarea
			value={draft}
			rows={1}
			maxLength={200}
			aria-label="Task title"
			className={cn(
				"-mx-1 mt-1 field-sizing-content w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl leading-snug font-semibold outline-none",
				"hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/30",
				done && "text-muted-foreground line-through",
			)}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.currentTarget.blur();
				} else if (event.key === "Escape") {
					setDraft(value);
					event.currentTarget.blur();
				}
			}}
		/>
	);
}

function InlineDescription({
	value,
	readOnly,
	onSave,
}: {
	value: string;
	readOnly: boolean;
	onSave: (value: string) => void;
}) {
	const [draft, setDraft] = React.useState(value);
	if (readOnly) {
		return value ? (
			<p className="text-sm whitespace-pre-wrap">{value}</p>
		) : (
			<Muted>No description.</Muted>
		);
	}
	return (
		<textarea
			value={draft}
			rows={3}
			maxLength={10_000}
			aria-label="Description"
			placeholder="What is this task about? Instructions for the worker."
			className={cn(
				"-mx-2 field-sizing-content min-h-20 w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none",
				"placeholder:text-muted-foreground hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/30",
			)}
			onChange={(event) => setDraft(event.target.value)}
			onBlur={() => {
				const next = draft.trim();
				if (next !== value.trim()) onSave(next);
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					setDraft(value);
					event.currentTarget.blur();
				}
			}}
		/>
	);
}

function InlineText({
	value,
	placeholder,
	readOnly,
	list,
	onSave,
	"aria-label": ariaLabel,
}: {
	value: string;
	placeholder: string;
	readOnly: boolean;
	list?: string[];
	onSave: (value: string) => void;
	"aria-label": string;
}) {
	const [draft, setDraft] = React.useState(value);
	const listId = React.useId();
	if (readOnly) {
		return value ? <Value>{value}</Value> : <Muted>{placeholder}</Muted>;
	}
	return (
		<>
			<input
				aria-label={ariaLabel}
				value={draft}
				maxLength={80}
				placeholder={placeholder}
				list={list && list.length > 0 ? listId : undefined}
				className={cn(
					"-ml-2 h-7 w-full max-w-64 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none",
					"placeholder:text-muted-foreground hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/30",
				)}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					const next = draft.trim();
					if (next !== value) onSave(next);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						event.currentTarget.blur();
					} else if (event.key === "Escape") {
						setDraft(value);
						event.currentTarget.blur();
					}
				}}
			/>
			{list && list.length > 0 && (
				<datalist id={listId}>
					{list.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</datalist>
			)}
		</>
	);
}

function InlineNumber({
	value,
	unit,
	placeholder = "",
	min,
	max,
	step,
	readOnly,
	formatValue = String,
	onSave,
	"aria-label": ariaLabel,
}: {
	value: number | null;
	unit: string;
	placeholder?: string;
	min: number;
	max: number;
	step: number;
	readOnly: boolean;
	formatValue?: (value: number) => string;
	onSave: (value: number | null) => void;
	"aria-label": string;
}) {
	const initial = value == null ? "" : formatValue(value);
	const [draft, setDraft] = React.useState(initial);
	if (readOnly) {
		return (
			<Value>
				{value == null ? placeholder : `${formatValue(value)} ${unit}`}
			</Value>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 text-sm">
			<input
				aria-label={ariaLabel}
				type="number"
				inputMode="decimal"
				value={draft}
				min={min}
				max={max}
				step={step}
				placeholder={placeholder}
				className={cn(
					"-ml-2 h-7 w-16 rounded-md border border-transparent bg-transparent px-2 text-right text-sm tabular-nums outline-none",
					"placeholder:text-muted-foreground hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/30",
					"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				)}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					if (draft.trim() === "") {
						if (value !== null) onSave(null);
						return;
					}
					const parsed = Number(draft);
					if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
						setDraft(initial);
						return;
					}
					if (parsed !== value) onSave(parsed);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						event.currentTarget.blur();
					} else if (event.key === "Escape") {
						setDraft(initial);
						event.currentTarget.blur();
					}
				}}
			/>
			<span className="text-muted-foreground">{unit}</span>
		</span>
	);
}

export function openTaskDetail(taskId: string, canPlan: boolean): void {
	void NiceModal.show(TaskDetailSheet, { taskId, canPlan });
}
