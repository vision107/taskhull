"use client";

import { format } from "date-fns";
import {
	ArrowLeftIcon,
	CalendarIcon,
	CheckCircle2Icon,
	CircleIcon,
	Loader2Icon,
	SendIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface MobileTaskDetailProps {
	taskId: string;
}

export function MobileTaskDetail({ taskId }: MobileTaskDetailProps): React.JSX.Element {
	const router = useRouter();
	const [commentText, setCommentText] = React.useState("");
	const utils = trpc.useUtils();

	const { data: task, isLoading } = trpc.organization.task.get.useQuery({ id: taskId });

	const updateStatus = trpc.organization.task.updateStatus.useMutation({
		onSuccess: () => {
			utils.organization.task.get.invalidate({ id: taskId });
			utils.organization.task.list.invalidate();
			toast.success("Task updated");
		},
		onError: (err) => toast.error(err.message),
	});

	const createComment = trpc.organization.task.createComment.useMutation({
		onSuccess: () => {
			utils.organization.task.get.invalidate({ id: taskId });
			setCommentText("");
		},
		onError: (err) => toast.error(err.message),
	});

	const { data: project } = trpc.organization.project.get.useQuery(
		{ id: task?.projectId ?? "" },
		{ enabled: !!task?.projectId },
	);

	const isDone = task?.status?.type === "done";
	const doneStatus = project?.taskStatuses.find((s) => s.type === "done");
	const todoStatus = project?.taskStatuses.find((s) => s.type === "todo");

	const handleToggleComplete = () => {
		if (!task) return;
		if (isDone) {
			updateStatus.mutate({ id: taskId, statusId: todoStatus?.id ?? null });
		} else {
			updateStatus.mutate({ id: taskId, statusId: doneStatus?.id ?? null });
		}
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

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3">
				<p className="text-muted-foreground">Task not found</p>
				<Link
					className="text-sm text-primary"
					href="/mobile/my-tasks"
				>
					← Back to tasks
				</Link>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{/* Top bar */}
			<div className="flex items-center gap-3 border-b px-4 py-3">
				<button
					className="rounded-full p-1"
					onClick={() => router.back()}
					type="button"
				>
					<ArrowLeftIcon className="size-5" />
				</button>
				<div className="flex-1 min-w-0">
					{task.status && (
						<div className="flex items-center gap-1.5 mb-0.5">
							<span
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: task.status.color }}
							/>
							<span className="text-xs text-muted-foreground">
								{task.status.name}
							</span>
						</div>
					)}
					<h1 className="font-semibold text-base leading-snug truncate">
						{task.title}
					</h1>
				</div>
			</div>

			{/* Scrollable content */}
			<ScrollArea className="flex-1">
				<div className="space-y-5 p-4">
					{/* Complete button - prominent CTA for workers */}
					<Button
						className={cn(
							"w-full h-12 text-base font-semibold rounded-xl",
							isDone && "opacity-80",
						)}
						disabled={updateStatus.isPending || !doneStatus}
						onClick={handleToggleComplete}
						variant={isDone ? "outline" : "default"}
					>
						{updateStatus.isPending ? (
							<Loader2Icon className="mr-2 size-5 animate-spin" />
						) : isDone ? (
							<CircleIcon className="mr-2 size-5" />
						) : (
							<CheckCircle2Icon className="mr-2 size-5" />
						)}
						{isDone ? "Mark as Incomplete" : "Mark as Complete"}
					</Button>

					{/* Task details */}
					<div className="space-y-3 rounded-xl border p-4">
						{task.dueDate && (
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">Due date</span>
								<div className="flex items-center gap-1.5">
									<CalendarIcon className="size-3.5 text-muted-foreground" />
									<span
										className={cn(
											"text-sm",
											!isDone &&
												new Date(task.dueDate) < new Date() &&
												"text-red-500",
										)}
									>
										{format(new Date(task.dueDate), "MMM d, yyyy")}
									</span>
								</div>
							</div>
						)}

						{task.assignee && (
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">Assigned to</span>
								<div className="flex items-center gap-2">
									<Avatar className="size-5">
										<AvatarImage src={task.assignee.image ?? undefined} />
										<AvatarFallback className="text-[9px]">
											{task.assignee.name.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm">{task.assignee.name}</span>
								</div>
							</div>
						)}

						<div className="flex items-center justify-between">
							<span className="text-sm text-muted-foreground">Priority</span>
							<span className="text-sm capitalize">{task.priority}</span>
						</div>

						{task.completedAt && (
							<div className="flex items-center justify-between">
								<span className="text-sm text-muted-foreground">Completed</span>
								<span className="text-sm text-green-600">
									{format(new Date(task.completedAt), "MMM d, yyyy")}
								</span>
							</div>
						)}
					</div>

				{/* Description */}
				{task.description != null && (
					<div>
							<h3 className="mb-2 font-medium text-sm">Description</h3>
							<div className="rounded-xl bg-muted/30 p-4 text-sm leading-relaxed">
								{typeof task.description === "object" &&
								task.description &&
								"content" in (task.description as object)
									? ((task.description as { content: Array<{ content?: Array<{ text?: string }> }> }).content ?? [])
										.flatMap((n) => n.content ?? [])
										.map((n) => n.text ?? "")
										.join("")
									: "View description in the web app"}
							</div>
						</div>
					)}

					{/* Labels */}
					{task.labels.length > 0 && (
						<div>
							<h3 className="mb-2 font-medium text-sm">Labels</h3>
							<div className="flex flex-wrap gap-2">
								{task.labels.map((tl) => (
									<span
										className="rounded-full px-3 py-1 text-xs font-medium"
										key={tl.labelId}
										style={{
											backgroundColor: `${tl.label.color}20`,
											color: tl.label.color,
										}}
									>
										{tl.label.name}
									</span>
								))}
							</div>
						</div>
					)}

					<Separator />

					{/* Comments */}
					<div>
						<h3 className="mb-3 font-medium text-sm">
							Comments ({task.comments.length})
						</h3>

						<div className="space-y-4">
							{task.comments.map((comment) => (
								<div className="flex gap-3" key={comment.id}>
									<Avatar className="size-8 shrink-0">
										<AvatarImage src={comment.user.image ?? undefined} />
										<AvatarFallback className="text-[10px]">
											{comment.user.name.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1">
										<div className="mb-1 flex items-baseline gap-2">
											<span className="text-xs font-semibold">
												{comment.user.name}
											</span>
											<span className="text-muted-foreground text-[10px]">
												{format(new Date(comment.createdAt), "MMM d, h:mm a")}
											</span>
										</div>
										<div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
											{typeof comment.content === "object" &&
											comment.content &&
											"content" in (comment.content as object)
												? ((comment.content as { content: Array<{ content?: Array<{ text?: string }> }> }).content ?? [])
													.flatMap((n) => n.content ?? [])
													.map((n) => n.text ?? "")
													.join("")
												: String(comment.content)}
										</div>
									</div>
								</div>
							))}
						</div>

						{/* Comment input */}
						<div className="mt-4 flex gap-2">
							<Textarea
								className="min-h-[80px] resize-none rounded-xl text-sm"
								onChange={(e) => setCommentText(e.target.value)}
								placeholder="Add a comment…"
								value={commentText}
							/>
						</div>
						<Button
							className="mt-2 w-full rounded-xl"
							disabled={!commentText.trim() || createComment.isPending}
							onClick={handleCommentSubmit}
						>
							{createComment.isPending ? (
								<Loader2Icon className="mr-2 size-4 animate-spin" />
							) : (
								<SendIcon className="mr-2 size-4" />
							)}
							Send Comment
						</Button>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
}
