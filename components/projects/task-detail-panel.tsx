"use client";

import { format } from "date-fns";
import {
	CheckCircle2Icon,
	ClockIcon,
	Loader2Icon,
	PaperclipIcon,
	SendIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { AssigneePicker } from "@/components/projects/pickers/assignee-picker";
import { DatePicker } from "@/components/projects/pickers/date-picker";
import { LabelPicker } from "@/components/projects/pickers/label-picker";
import {
	PRIORITY_META,
	PriorityPicker,
	type TaskPriorityValue,
} from "@/components/projects/pickers/priority-picker";
import { StatusPicker } from "@/components/projects/pickers/status-picker";
import { RichTextEditor } from "@/components/projects/rich-text-editor";
import { TemplateStatsCard } from "@/components/projects/template-stats-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface TaskDetailPanelProps {
	taskId: string;
	onClose: () => void;
}

export function TaskDetailPanel({
	taskId,
	onClose,
}: TaskDetailPanelProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const [commentText, setCommentText] = React.useState("");
	const [descriptionContent, setDescriptionContent] =
		React.useState<unknown>(null);
	const [descriptionDirty, setDescriptionDirty] = React.useState(false);
	const [activeTab, setActiveTab] = React.useState<"comments" | "activity">(
		"comments",
	);

	const { data: task, isLoading } = trpc.organization.task.get.useQuery({
		id: taskId,
	});

	React.useEffect(() => {
		if (task?.description) {
			setDescriptionContent(task.description);
			setDescriptionDirty(false);
		}
	}, [task?.id]);

	const invalidateTask = React.useCallback(() => {
		utils.organization.task.get.invalidate({ id: taskId });
		utils.organization.task.list.invalidate();
		utils.organization.task.listForOrg.invalidate();
	}, [utils, taskId]);

	const updateTask = trpc.organization.task.update.useMutation({
		onSuccess: invalidateTask,
		onError: (err) => toast.error(err.message),
	});

	const updateStatus = trpc.organization.task.updateStatus.useMutation({
		onSuccess: invalidateTask,
		onError: (err) => toast.error(err.message),
	});

	const createComment = trpc.organization.task.createComment.useMutation({
		onSuccess: () => {
			utils.organization.task.get.invalidate({ id: taskId });
			setCommentText("");
			toast.success("Comment added");
		},
		onError: (err) => toast.error(err.message),
	});

	const handleSaveDescription = () => {
		if (!descriptionDirty) return;
		updateTask.mutate({ id: taskId, description: descriptionContent });
		setDescriptionDirty(false);
	};

	const handleCommentSubmit = () => {
		if (!commentText.trim()) return;
		createComment.mutate({
			taskId,
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: commentText }],
					},
				],
			},
		});
	};

	const projectId = task?.projectId;
	const { data: project } = trpc.organization.project.get.useQuery(
		{ id: projectId ?? "" },
		{ enabled: Boolean(projectId) },
	);

	// Candidate assignees: prefer project members for privacy/relevance,
	// fall back to all org members via the picker default.
	const projectMemberCandidates = React.useMemo(
		() =>
			project?.members.map((m) => ({
				userId: m.userId,
				name: m.user.name,
				email: m.user.email,
				image: m.user.image,
			})) ?? undefined,
		[project?.members],
	);

	const statusOptions = React.useMemo(
		() =>
			project?.taskStatuses.map((s) => ({
				id: s.id,
				name: s.name,
				color: s.color,
				type: s.type,
			})) ?? [],
		[project?.taskStatuses],
	);

	const labelOptions = React.useMemo(
		() =>
			project?.labels.map((l) => ({
				id: l.id,
				name: l.name,
				color: l.color,
			})) ?? [],
		[project?.labels],
	);

	return (
		<Sheet onOpenChange={(open) => !open && onClose()} open>
			<SheetContent
				className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
				side="right"
			>
				{isLoading || !task ? (
					<>
						<SheetTitle className="sr-only">Task details</SheetTitle>
						<div className="flex h-full items-center justify-center">
							{isLoading ? (
								<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
							) : (
								<p className="text-muted-foreground text-sm">Task not found</p>
							)}
						</div>
					</>
				) : (
					<>
						<SheetHeader className="border-b px-6 py-4 pr-14">
							<div className="mb-1 flex items-center gap-2">
								{task.status && (
									<span
										className="h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: task.status.color }}
									/>
								)}
								<span className="text-muted-foreground text-xs">
									#{task.sequenceId}
								</span>
							</div>
							<SheetTitle className="text-left text-lg leading-snug">
								{task.title}
							</SheetTitle>
						</SheetHeader>

						<div className="flex flex-1 overflow-hidden">
							{/* Main content */}
							<ScrollArea className="flex-1">
								<div className="space-y-5 p-6">
									{/* Description */}
									<div>
										<h4 className="mb-2 font-medium text-sm">Description</h4>
										<RichTextEditor
											content={descriptionContent ?? task.description}
											onBlur={handleSaveDescription}
											onChange={(content) => {
												setDescriptionContent(content);
												setDescriptionDirty(true);
											}}
											placeholder="Add a description…"
										/>
										{descriptionDirty && (
											<button
												className="mt-1 text-xs text-primary hover:underline"
												onClick={handleSaveDescription}
												type="button"
											>
												Save
											</button>
										)}
									</div>

									<Separator />

									<TemplateStatsCard taskId={taskId} />

									{/* Attachments */}
									{task.attachments.length > 0 && (
										<div>
											<h4 className="mb-2 font-medium text-sm">
												Attachments
											</h4>
											<div className="space-y-1">
												{task.attachments.map((att) => (
													<div
														className="flex items-center gap-2 rounded-md border p-2"
														key={att.id}
													>
														<PaperclipIcon className="size-3.5 text-muted-foreground" />
														<span className="flex-1 truncate text-xs">
															{att.fileName}
														</span>
														<span className="text-muted-foreground text-xs">
															{att.mimeType?.split("/")[1]}
														</span>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Comments / Activity tabs */}
									<div>
										<div className="mb-3 flex gap-4 border-b">
											<button
												className={cn(
													"border-b-2 pb-1.5 text-sm transition-colors",
													activeTab === "comments"
														? "border-primary font-medium"
														: "border-transparent text-muted-foreground",
												)}
												onClick={() => setActiveTab("comments")}
												type="button"
											>
												Comments
											</button>
											<button
												className={cn(
													"border-b-2 pb-1.5 text-sm transition-colors",
													activeTab === "activity"
														? "border-primary font-medium"
														: "border-transparent text-muted-foreground",
												)}
												onClick={() => setActiveTab("activity")}
												type="button"
											>
												Activity
											</button>
										</div>

										{activeTab === "comments" ? (
											<div className="space-y-3">
												{task.comments.map((comment) => (
													<div className="flex gap-3" key={comment.id}>
														<Avatar className="size-7 shrink-0">
															<AvatarImage
																src={comment.user.image ?? undefined}
															/>
															<AvatarFallback className="text-[10px]">
																{comment.user.name
																	.slice(0, 2)
																	.toUpperCase()}
															</AvatarFallback>
														</Avatar>
														<div className="flex-1">
															<div className="mb-0.5 flex items-center gap-2">
																<span className="font-medium text-xs">
																	{comment.user.name}
																</span>
																<span className="text-[10px] text-muted-foreground">
																	{format(
																		new Date(comment.createdAt),
																		"MMM d, h:mm a",
																	)}
																</span>
															</div>
															<div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
																{typeof comment.content === "object" &&
																comment.content &&
																"content" in (comment.content as object)
																	? (
																			(
																				comment.content as {
																					content: Array<{
																						content?: Array<{ text?: string }>;
																					}>;
																				}
																			).content ?? []
																		)
																			.flatMap((n) => n.content ?? [])
																			.map((n) => n.text ?? "")
																			.join("")
																	: String(comment.content)}
															</div>
														</div>
													</div>
												))}

												{/* Comment input */}
												<div className="flex gap-2 pt-1">
													<Textarea
														className="min-h-[60px] resize-none text-sm"
														onChange={(e) => setCommentText(e.target.value)}
														onKeyDown={(e) => {
															if (
																e.key === "Enter" &&
																(e.metaKey || e.ctrlKey)
															) {
																handleCommentSubmit();
															}
														}}
														placeholder="Add a comment… (Cmd+Enter to submit)"
														value={commentText}
													/>
													<Button
														className="shrink-0 self-end"
														disabled={
															!commentText.trim() || createComment.isPending
														}
														onClick={handleCommentSubmit}
														size="sm"
													>
														{createComment.isPending ? (
															<Loader2Icon className="size-4 animate-spin" />
														) : (
															<SendIcon className="size-4" />
														)}
													</Button>
												</div>
											</div>
										) : (
											<div className="space-y-2">
												{task.activities.map((activity) => (
													<div
														className="flex items-start gap-2 text-xs"
														key={activity.id}
													>
														<div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
														<div className="flex-1 text-muted-foreground">
															<span className="font-medium text-foreground">
																{activity.user?.name ?? "System"}
															</span>{" "}
															{activity.type.replace(/_/g, " ")}{" "}
															{activity.oldValue && activity.newValue ? (
																<>
																	from{" "}
																	<code className="rounded bg-muted px-1">
																		{activity.oldValue}
																	</code>{" "}
																	to{" "}
																	<code className="rounded bg-muted px-1">
																		{activity.newValue}
																	</code>
																</>
															) : null}
															<span className="ml-2 text-[10px] opacity-60">
																{format(
																	new Date(activity.createdAt),
																	"MMM d",
																)}
															</span>
														</div>
													</div>
												))}
												{task.activities.length === 0 && (
													<p className="text-muted-foreground text-xs">
														No activity yet
													</p>
												)}
											</div>
										)}
									</div>
								</div>
							</ScrollArea>

							{/* Sidebar (properties) */}
							<div className="w-64 shrink-0 border-l">
								<ScrollArea className="h-full">
									<div className="space-y-4 p-4">
										{/* Status */}
										<PropertyRow label="Status">
											<StatusPicker
												value={task.statusId ?? null}
												onChange={(statusId) =>
													updateStatus.mutate({ id: taskId, statusId })
												}
												options={statusOptions}
												className="w-full justify-start"
											/>
										</PropertyRow>

										{/* Priority */}
										<PropertyRow label="Priority">
											<PriorityPicker
												value={task.priority as TaskPriorityValue}
												onChange={(priority) =>
													updateTask.mutate({ id: taskId, priority })
												}
												className="w-full justify-start"
											/>
										</PropertyRow>

										{/* Assignee */}
										<PropertyRow label="Assignee">
											<AssigneePicker
												value={task.assigneeId ?? null}
												onChange={(assigneeId) =>
													updateTask.mutate({ id: taskId, assigneeId })
												}
												candidates={projectMemberCandidates}
												currentUser={
													task.assignee
														? {
																userId: task.assignee.id,
																name: task.assignee.name,
																image: task.assignee.image,
															}
														: null
												}
												className="w-full justify-start"
											/>
										</PropertyRow>

										{/* Due Date */}
										<PropertyRow label="Due Date">
											<DatePicker
												value={task.dueDate ?? null}
												onChange={(dueDate) =>
													updateTask.mutate({ id: taskId, dueDate })
												}
												placeholder="Set due date"
												highlightOverdue
												className="w-full justify-start"
											/>
										</PropertyRow>

										{/* Start Date */}
										<PropertyRow label="Start Date">
											<DatePicker
												value={task.startDate ?? null}
												onChange={(startDate) =>
													updateTask.mutate({ id: taskId, startDate })
												}
												placeholder="Set start date"
												className="w-full justify-start"
											/>
										</PropertyRow>

										{/* Effort */}
										<PropertyRow label="Effort (hours)">
											<div className="grid grid-cols-2 gap-2">
												<HoursInput
													label="Est."
													value={task.estimatedHours ?? null}
													onCommit={(v) =>
														updateTask.mutate({
															id: taskId,
															estimatedHours: v,
														})
													}
												/>
												<HoursInput
													label="Actual"
													value={task.actualHours ?? null}
													onCommit={(v) =>
														updateTask.mutate({
															id: taskId,
															actualHours: v,
														})
													}
												/>
											</div>
										</PropertyRow>

										{/* Labels */}
										<PropertyRow label="Labels">
											<LabelPicker
												value={task.labels.map((tl) => tl.labelId)}
												onChange={(labelIds) =>
													updateTask.mutate({ id: taskId, labelIds })
												}
												options={labelOptions}
												className="w-full"
											/>
										</PropertyRow>

										{/* Completed */}
										{task.completedAt && (
											<PropertyRow label="Completed">
												<div className="flex items-center gap-1 text-xs text-green-600">
													<CheckCircle2Icon className="size-3" />
													<span>
														{format(
															new Date(task.completedAt),
															"MMM d, yyyy",
														)}
													</span>
												</div>
											</PropertyRow>
										)}

										{/* Created */}
										<PropertyRow label="Created">
											<div className="flex items-center gap-1 text-xs text-muted-foreground">
												<ClockIcon className="size-3" />
												{format(new Date(task.createdAt), "MMM d, yyyy")}
											</div>
										</PropertyRow>
									</div>
								</ScrollArea>
							</div>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}

function PropertyRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<div>
			<p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
				{label}
			</p>
			{children}
		</div>
	);
}

function HoursInput({
	label,
	value,
	onCommit,
}: {
	label: string;
	value: number | null;
	onCommit: (value: number | null) => void;
}): React.JSX.Element {
	const [local, setLocal] = React.useState<string>(
		value === null ? "" : String(value),
	);
	const lastSyncRef = React.useRef(value);

	React.useEffect(() => {
		if (lastSyncRef.current !== value) {
			lastSyncRef.current = value;
			setLocal(value === null ? "" : String(value));
		}
	}, [value]);

	const commit = () => {
		const trimmed = local.trim();
		if (trimmed === "") {
			if (value !== null) onCommit(null);
			return;
		}
		const parsed = Number(trimmed);
		if (!Number.isFinite(parsed) || parsed < 0) {
			setLocal(value === null ? "" : String(value));
			return;
		}
		if (parsed !== value) onCommit(parsed);
	};

	return (
		<div>
			<p className="mb-0.5 text-[10px] text-muted-foreground">{label}</p>
			<Input
				className="h-7 text-xs"
				inputMode="decimal"
				onBlur={commit}
				onChange={(e) => setLocal(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						(e.target as HTMLInputElement).blur();
					}
				}}
				placeholder="—"
				value={local}
			/>
		</div>
	);
}
