"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
	ArrowLeftIcon,
	CameraIcon,
	CheckIcon,
	ChevronDownIcon,
	DownloadIcon,
	FileIcon,
	ImageIcon,
	ListTreeIcon,
	LockIcon,
	PlayIcon,
	RotateCcwIcon,
	SendIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ActivityTimeline } from "@/components/manufacturing/activity-timeline";
import { CommentBody } from "@/components/manufacturing/comment-body";
import {
	MentionTextarea,
	useMentionDraft,
} from "@/components/manufacturing/mention-textarea";
import { TaskStatusBadge } from "@/components/manufacturing/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user/user-avatar";
import { BlockReasonSheet } from "@/components/work/block-reason-sheet";
import { useOffline } from "@/components/work/offline-provider";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import { useSession } from "@/hooks/use-session";
import type {
	BuildTaskStatus,
	ChecklistItemStatus,
} from "@/lib/db/schema/enums";
import { formatBytes } from "@/lib/manufacturing/format";
import { downscalePhoto } from "@/lib/manufacturing/image-client";
import {
	assertUploadAllowed,
	normalizeContentType,
	PHOTO_ACCEPT,
} from "@/lib/manufacturing/uploads";
import {
	canUsePhotoStore,
	deletePhoto,
	putPhoto,
} from "@/lib/offline/photo-store";
import { isNetworkError, removeWrite } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export function WorkTaskDetail({
	taskId,
}: {
	taskId: string;
}): React.JSX.Element {
	const utils = trpc.useUtils();
	const { user } = useSession();
	const currentUserId = user?.id;
	const { data: task, isLoading } = trpc.organization.work.getTask.useQuery({
		id: taskId,
	});

	const offline = useOffline();
	const { t, dateLocale } = useWorkLocale();
	const commentDraft = useMentionDraft();
	const pendingPhotos = offline.pending.filter(
		(item): item is Extract<typeof item, { kind: "uploadPhoto" }> =>
			item.kind === "uploadPhoto" && item.taskId === taskId,
	);
	const pendingComments = offline.pending.filter(
		(item): item is Extract<typeof item, { kind: "addComment" }> =>
			item.kind === "addComment" && item.taskId === taskId,
	);

	const invalidate = () => {
		void utils.organization.work.getTask.invalidate({ id: taskId });
		void utils.organization.work.myTasks.invalidate();
	};

	// -- offline fallbacks ----------------------------------------------------
	// When there is no connection the change is stored locally, the cached
	// task is patched so the screen reflects it, and the provider replays it
	// once the phone is back online.

	const queueStatus = (next: BuildTaskStatus, reason?: string) => {
		offline.enqueue({
			kind: "updateStatus",
			taskId,
			input: { id: taskId, status: next, reason },
		});
		utils.organization.work.getTask.setData({ id: taskId }, (old) =>
			old ? { ...old, status: next } : old,
		);
		toast(t.detail.savedOffline, {
			description: t.detail.willSyncOnline,
		});
	};

	const queueChecklist = (itemId: string, next: ChecklistItemStatus) => {
		offline.enqueue({
			kind: "updateChecklistItem",
			taskId,
			input: { id: itemId, status: next },
		});
		utils.organization.work.getTask.setData({ id: taskId }, (old) =>
			old
				? {
						...old,
						checklistItems: old.checklistItems.map((item) =>
							item.id === itemId ? { ...item, status: next } : item,
						),
					}
				: old,
		);
	};

	const queueComment = (body: string) => {
		offline.enqueue({
			kind: "addComment",
			taskId,
			input: { buildTaskId: taskId, body },
		});
		commentDraft.reset();
		toast(t.detail.commentSavedOffline);
	};

	const queuePhoto = async (file: File, contentType: string) => {
		if (!canUsePhotoStore()) {
			throw new Error(t.detail.offlinePhotosUnsupported);
		}
		const photoId = crypto.randomUUID();
		await putPhoto({
			id: photoId,
			taskId,
			fileName: file.name,
			contentType,
			sizeBytes: file.size,
			blob: file,
			createdAt: Date.now(),
		});
		offline.enqueue({
			kind: "uploadPhoto",
			taskId,
			input: {
				buildTaskId: taskId,
				photoId,
				fileName: file.name,
				contentType,
				sizeBytes: file.size,
			},
		});
	};

	const statusMutation = trpc.organization.work.updateStatus.useMutation({
		onSuccess: (after) => {
			if (after.status === "done") toast.success(t.detail.taskFinished);
			invalidate();
		},
		onError: (error, variables) => {
			if (isNetworkError(error))
				queueStatus(variables.status, variables.reason);
			else toast.error(error.message);
		},
	});
	const checklistMutation =
		trpc.organization.work.updateChecklistItem.useMutation({
			onSuccess: invalidate,
			onError: (error, variables) => {
				if (isNetworkError(error))
					queueChecklist(variables.id, variables.status);
				else toast.error(error.message);
			},
		});
	const commentMutation = trpc.organization.work.addComment.useMutation({
		onSuccess: () => {
			commentDraft.reset();
			invalidate();
		},
		onError: (error, variables) => {
			if (isNetworkError(error)) queueComment(variables.body);
			else toast.error(error.message);
		},
	});
	const deleteCommentMutation =
		trpc.organization.work.deleteComment.useMutation({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		});
	const uploadUrlMutation =
		trpc.organization.work.attachmentUploadUrl.useMutation();
	const addAttachmentMutation =
		trpc.organization.work.addAttachment.useMutation();
	const deleteAttachmentMutation =
		trpc.organization.work.deleteAttachment.useMutation({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		});

	const [uploading, setUploading] = React.useState(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	if (isLoading || !task) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-32 w-full rounded-xl" />
				<Skeleton className="h-48 w-full rounded-xl" />
			</div>
		);
	}

	const status = task.status as BuildTaskStatus;
	const canEdit = task.canEdit;
	const blocked = task.blockers.length > 0;
	const openChecklist = task.checklistItems.filter(
		(item) => item.status === "open",
	).length;
	// A photo waiting in the offline queue counts: it is replayed before any
	// queued "done" so the server-side check passes as well.
	const missingPhoto =
		task.requiresPhoto &&
		task.uploads.length === 0 &&
		pendingPhotos.length === 0;
	const missingComment = task.requiresComment && task.comments.length === 0;
	const openSubtasks = task.subtasks.filter(
		(subtask) => subtask.status !== "done",
	).length;

	const setStatus = (next: BuildTaskStatus, reason?: string) => {
		if (!offline.online) {
			queueStatus(next, reason);
			return;
		}
		statusMutation.mutate({ id: task.id, status: next, reason });
	};

	const askBlockReason = () => {
		void NiceModal.show(BlockReasonSheet, {
			taskTitle: task.title,
			labels: t.block,
			onSubmit: (reason) => setStatus("blocked", reason),
		});
	};

	const download = async (attachmentId: string) => {
		try {
			const result = await utils.organization.work.attachmentDownloadUrl.fetch({
				attachmentId,
			});
			window.open(result.url, "_blank", "noopener");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t.detail.downloadFailed,
			);
		}
	};

	const handleFiles = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		setUploading(true);
		let uploaded = 0;
		let queued = 0;
		try {
			for (const original of Array.from(files)) {
				// Reject obviously wrong files before touching the network, then
				// shrink phone photos so they stay well under the size cap.
				assertUploadAllowed("photo", {
					fileName: original.name,
					contentType: original.type,
					sizeBytes: original.size,
				});
				const file = await downscalePhoto(original);
				assertUploadAllowed("photo", {
					fileName: file.name,
					contentType: file.type,
					sizeBytes: file.size,
				});
				const contentType = normalizeContentType(file.type);

				if (!offline.online) {
					await queuePhoto(file, contentType);
					queued++;
					continue;
				}

				try {
					const { storageKey, signedUrl } = await uploadUrlMutation.mutateAsync(
						{
							buildTaskId: task.id,
							fileName: file.name,
							contentType,
							sizeBytes: file.size,
						},
					);
					const response = await fetch(signedUrl, {
						method: "PUT",
						body: file,
						headers: { "Content-Type": contentType },
					});
					if (!response.ok) {
						throw new Error(
							`Upload of ${file.name} failed (${response.status})`,
						);
					}
					await addAttachmentMutation.mutateAsync({
						buildTaskId: task.id,
						storageKey,
						fileName: file.name,
						contentType,
						sizeBytes: file.size,
					});
					uploaded++;
				} catch (error) {
					// Connection dropped mid-way: keep the photo and retry later.
					if (!isNetworkError(error)) throw error;
					await queuePhoto(file, contentType);
					queued++;
				}
			}
			if (uploaded > 0) {
				toast.success(
					uploaded === 1 ? t.detail.photoAdded : t.detail.photosAdded,
				);
				invalidate();
			}
			if (queued > 0) {
				toast(
					queued === 1
						? t.detail.photoSavedOffline
						: t.detail.photosSavedOffline,
					{ description: t.detail.willUploadOnline },
				);
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t.detail.uploadFailed,
			);
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	return (
		<div className="space-y-4 pb-28">
			{/* Top bar */}
			<div className="flex items-center gap-2">
				<Link
					href="/dashboard/work"
					aria-label={t.detail.back}
					className="inline-flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
				>
					<ArrowLeftIcon className="size-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<p className="truncate text-xs text-muted-foreground">
						{task.build.templateVersion?.template.name ??
							task.build.name ??
							"Project"}{" "}
						· {task.build.serialNumber}
						{task.phase ? ` · ${task.phase}` : ""}
					</p>
					{task.parent && (
						<Link
							href={`/dashboard/work/tasks/${task.parent.id}`}
							className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
						>
							<ListTreeIcon className="size-3 shrink-0" />
							<span className="truncate">{task.parent.title}</span>
						</Link>
					)}
					<h1 className="truncate text-lg leading-tight font-semibold">
						{task.title}
					</h1>
				</div>
				<TaskStatusBadge status={status} labels={t.status} />
			</div>

			{/* Schedule + assignees */}
			<div className="rounded-xl border bg-background p-4 text-sm">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span className="text-muted-foreground">
						{task.startDate
							? `${format(parseISO(task.startDate), "EEE, d. MMM", { locale: dateLocale })} · ${t.detail.days(task.plannedDurationDays)}`
							: t.detail.unscheduled}
						{task.plannedHours != null &&
							` · ${t.detail.hours(task.plannedHours)}`}
					</span>
					<span className="flex items-center gap-1">
						{task.assignments.map((assignment) => (
							<UserAvatar
								key={assignment.id}
								name={assignment.user.name}
								src={assignment.user.image}
								className="size-6"
								fallbackClassName="text-[10px]"
							/>
						))}
					</span>
				</div>
				{blocked && (
					<div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
						<LockIcon className="mt-0.5 size-4 shrink-0" />
						<div>
							<p className="font-medium">{t.detail.waitingOn}</p>
							<ul className="mt-0.5 list-inside list-disc">
								{task.blockers.map((blocker) => (
									<li key={blocker.id}>{blocker.title}</li>
								))}
							</ul>
						</div>
					</div>
				)}
				{!task.isAssigned && canEdit && (
					<p className="mt-3 text-xs text-muted-foreground">
						{t.detail.viewingAsPlanner}
					</p>
				)}
			</div>

			{/* Subtasks: each is its own task; this one is confirmed by hand */}
			{task.subtasks.length > 0 && (
				<Card
					title={t.detail.subtasks}
					aside={`${task.subtasks.length - openSubtasks}/${task.subtasks.length}`}
				>
					<ul className="divide-y">
						{task.subtasks.map((subtask) => (
							<li key={subtask.id}>
								<Link
									href={`/dashboard/work/tasks/${subtask.id}`}
									className="flex items-center gap-2 py-2 text-sm active:bg-muted/60"
								>
									<span
										className={cn(
											"min-w-0 flex-1 truncate",
											subtask.status === "done" &&
												"text-muted-foreground line-through",
										)}
									>
										{subtask.title}
									</span>
									{subtask.assignments.length > 0 && (
										<span className="flex shrink-0 -space-x-1.5">
											{subtask.assignments.map((assignment) => (
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
									<TaskStatusBadge status={subtask.status} labels={t.status} />
								</Link>
							</li>
						))}
					</ul>
					{openSubtasks > 0 && status !== "done" && (
						<p className="mt-2 text-xs text-muted-foreground">
							{t.detail.subtasksOpen(openSubtasks)}
						</p>
					)}
				</Card>
			)}

			{/* Instructions */}
			{task.instructions && (
				<Card title={t.detail.instructions}>
					<p className="text-sm whitespace-pre-wrap">{task.instructions}</p>
				</Card>
			)}

			{/* Checklist */}
			{task.checklistItems.length > 0 && (
				<Card
					title={t.detail.checklist}
					aside={`${task.checklistItems.length - openChecklist}/${task.checklistItems.length}`}
				>
					<ul className="-mx-2 divide-y">
						{task.checklistItems.map((item) => {
							const done = item.status !== "open";
							return (
								<li key={item.id}>
									<button
										type="button"
										disabled={!canEdit || checklistMutation.isPending}
										onClick={() => {
											const next = done ? "open" : "done";
											if (!offline.online) {
												queueChecklist(item.id, next);
												return;
											}
											checklistMutation.mutate({ id: item.id, status: next });
										}}
										className="flex w-full items-start gap-3 px-2 py-3 text-left active:bg-muted/60 disabled:opacity-70"
									>
										<span
											className={cn(
												"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
												done
													? "border-emerald-500 bg-emerald-500 text-white"
													: "border-muted-foreground/40",
											)}
										>
											{done && <CheckIcon className="size-3.5" />}
										</span>
										<span className="min-w-0 flex-1">
											<span
												className={cn(
													"block",
													done && "text-muted-foreground line-through",
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
				</Card>
			)}

			{/* Documents from the template */}
			{task.documents.length > 0 && (
				<Card title={t.detail.documents}>
					<ul className="-mx-2 divide-y">
						{task.documents.map((doc) => (
							<li key={doc.id}>
								<button
									type="button"
									onClick={() => download(doc.id)}
									className="flex w-full items-center gap-3 px-2 py-3 text-left active:bg-muted/60"
								>
									<FileIcon className="size-5 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm">
											{doc.fileName}
										</span>
										{doc.sizeBytes != null && (
											<span className="block text-xs text-muted-foreground">
												{formatBytes(doc.sizeBytes)}
											</span>
										)}
									</span>
									<DownloadIcon className="size-4 shrink-0 text-muted-foreground" />
								</button>
							</li>
						))}
					</ul>
				</Card>
			)}

			{/* Photos & uploads */}
			<Card
				title={t.detail.photos}
				aside={
					task.requiresPhoto ? (
						<span
							className={cn(
								"text-xs",
								missingPhoto
									? "text-red-600 dark:text-red-400"
									: "text-emerald-600",
							)}
						>
							{missingPhoto ? t.detail.required : t.detail.requiredDone}
						</span>
					) : undefined
				}
			>
				{pendingPhotos.length > 0 && (
					<ul className="-mx-2 mb-2 divide-y">
						{pendingPhotos.map((item) => (
							<li
								key={item.id}
								className="flex items-center gap-3 px-2 py-2 opacity-70"
							>
								<ImageIcon className="size-5 shrink-0 text-muted-foreground" />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm">
										{item.input.fileName}
									</span>
									<span className="block text-xs text-muted-foreground">
										{formatBytes(item.input.sizeBytes)} ·{" "}
										{t.detail.waitingToSync}
									</span>
								</span>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={t.detail.discard(item.input.fileName)}
									onClick={() => {
										removeWrite(item.id);
										void deletePhoto(item.input.photoId).catch(() => undefined);
									}}
								>
									<XIcon />
								</Button>
							</li>
						))}
					</ul>
				)}
				{task.uploads.length > 0 && (
					<ul className="-mx-2 mb-2 divide-y">
						{task.uploads.map((upload) => (
							<li key={upload.id} className="flex items-center gap-3 px-2 py-2">
								<button
									type="button"
									onClick={() => download(upload.id)}
									className="flex min-w-0 flex-1 items-center gap-3 text-left"
								>
									<ImageIcon className="size-5 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm">
											{upload.fileName}
										</span>
										<span className="block text-xs text-muted-foreground">
											{upload.uploadedBy?.name ?? t.detail.unknownUser} ·{" "}
											{formatDistanceToNow(upload.createdAt, {
												addSuffix: true,
												locale: dateLocale,
											})}
										</span>
									</span>
								</button>
								{canEdit && (
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label={t.detail.remove(upload.fileName)}
										onClick={() =>
											deleteAttachmentMutation.mutate({ id: upload.id })
										}
									>
										<XIcon />
									</Button>
								)}
							</li>
						))}
					</ul>
				)}
				{canEdit && (
					<>
						<input
							ref={fileInputRef}
							type="file"
							accept={PHOTO_ACCEPT}
							capture="environment"
							multiple
							className="hidden"
							onChange={(event) => handleFiles(event.target.files)}
						/>
						<Button
							variant="outline"
							className="w-full"
							onClick={() => fileInputRef.current?.click()}
							loading={uploading}
							disabled={uploading}
						>
							<CameraIcon />
							{task.uploads.length === 0 && pendingPhotos.length === 0
								? t.detail.takePhoto
								: t.detail.addAnother}
						</Button>
					</>
				)}
			</Card>

			{/* Comments */}
			<Card
				title={t.detail.comments}
				aside={
					task.requiresComment ? (
						<span
							className={cn(
								"text-xs",
								missingComment
									? "text-red-600 dark:text-red-400"
									: "text-emerald-600",
							)}
						>
							{missingComment ? t.detail.required : t.detail.requiredDone}
						</span>
					) : undefined
				}
			>
				{task.comments.length > 0 && (
					<ul className="mb-3 space-y-3">
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
											{item.author?.name ?? t.detail.formerMember}
										</span>
										<span className="text-xs text-muted-foreground">
											{formatDistanceToNow(item.createdAt, {
												addSuffix: true,
												locale: dateLocale,
											})}
										</span>
										{item.authorId === currentUserId && (
											<button
												type="button"
												className="ml-auto text-muted-foreground hover:text-destructive"
												aria-label={t.detail.deleteComment}
												onClick={() =>
													deleteCommentMutation.mutate({ id: item.id })
												}
											>
												<Trash2Icon className="size-3.5" />
											</button>
										)}
									</div>
									<CommentBody body={item.body} currentUserId={currentUserId} />
								</div>
							</li>
						))}
					</ul>
				)}
				{pendingComments.length > 0 && (
					<ul className="mb-3 space-y-3">
						{pendingComments.map((item) => (
							<li key={item.id} className="flex gap-3 opacity-70">
								<UserAvatar
									name={user?.name ?? "?"}
									src={user?.image ?? null}
									className="size-7"
									fallbackClassName="text-xs"
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-baseline gap-2">
										<span className="text-sm font-medium">{user?.name}</span>
										<span className="text-xs text-muted-foreground">
											{t.detail.waitingToSync}
										</span>
									</div>
									<CommentBody
										body={item.input.body}
										currentUserId={currentUserId}
									/>
								</div>
							</li>
						))}
					</ul>
				)}
				<form
					className="flex items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						const body = commentDraft.body;
						if (!body) return;
						if (!offline.online) {
							queueComment(body);
							return;
						}
						commentMutation.mutate({ buildTaskId: task.id, body });
					}}
				>
					<MentionTextarea
						draft={commentDraft.draft}
						onDraftChange={commentDraft.setDraft}
						excludeUserId={currentUserId}
						labels={{
							noMatches: t.detail.mentionNoMatches,
							loading: t.detail.mentionLoading,
						}}
						placeholder={t.detail.commentPlaceholder}
						rows={2}
						className="min-h-0 resize-none"
						aria-label={t.detail.newComment}
					/>
					<Button
						type="submit"
						size="icon"
						aria-label={t.detail.sendComment}
						disabled={!commentDraft.body || commentMutation.isPending}
						loading={commentMutation.isPending}
					>
						<SendIcon />
					</Button>
				</form>
			</Card>

			<details className="group rounded-xl border bg-background px-4 py-3">
				<summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
					{t.detail.history}
					<ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
				</summary>
				<div className="pt-3">
					<ActivityTimeline buildTaskId={task.id} limit={30} compact />
				</div>
			</details>

			{/* Sticky action bar */}
			{canEdit && (
				<div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
					<div className="mx-auto flex w-full max-w-lg gap-2 px-4 pt-3">
						{status === "todo" && (
							<>
								<Button
									className="flex-1"
									size="lg"
									onClick={() => setStatus("in_progress")}
									disabled={statusMutation.isPending}
								>
									<PlayIcon />
									{t.detail.start}
								</Button>
								<Button
									variant="outline"
									size="lg"
									onClick={askBlockReason}
									disabled={statusMutation.isPending}
								>
									{t.detail.blocked}
								</Button>
							</>
						)}
						{status === "in_progress" && (
							<>
								<Button
									className="flex-1"
									size="lg"
									onClick={() => setStatus("done")}
									disabled={
										statusMutation.isPending || blocked || openSubtasks > 0
									}
								>
									<CheckIcon />
									{t.detail.markDone}
								</Button>
								<Button
									variant="outline"
									size="lg"
									onClick={askBlockReason}
									disabled={statusMutation.isPending}
								>
									{t.detail.blocked}
								</Button>
							</>
						)}
						{status === "blocked" && (
							<Button
								className="flex-1"
								size="lg"
								onClick={() => setStatus("in_progress")}
								disabled={statusMutation.isPending}
							>
								<PlayIcon />
								{t.detail.resume}
							</Button>
						)}
						{status === "review" && (
							<>
								<Button
									className="flex-1"
									size="lg"
									onClick={() => setStatus("done")}
									disabled={statusMutation.isPending}
								>
									<CheckIcon />
									{t.detail.markDone}
								</Button>
								<Button
									variant="outline"
									size="lg"
									onClick={() => setStatus("in_progress")}
									disabled={statusMutation.isPending}
								>
									{t.detail.reopen}
								</Button>
							</>
						)}
						{status === "done" && (
							<Button
								variant="outline"
								className="flex-1"
								size="lg"
								onClick={() => setStatus("in_progress")}
								disabled={statusMutation.isPending}
							>
								<RotateCcwIcon />
								{t.detail.reopen}
							</Button>
						)}
					</div>
					{status === "in_progress" &&
						(missingPhoto || missingComment || openSubtasks > 0) && (
							<p className="mx-auto max-w-lg px-4 pt-2 text-center text-xs text-muted-foreground">
								{t.detail.beforeFinishing(
									[
										openSubtasks > 0 ? t.detail.finishSubtasksFirst : null,
										missingPhoto ? t.detail.addPhoto : null,
										missingComment ? t.detail.leaveComment : null,
									].filter((part): part is string => Boolean(part)),
								)}
							</p>
						)}
				</div>
			)}
		</div>
	);
}

function Card({
	title,
	aside,
	children,
}: React.PropsWithChildren<{ title: string; aside?: React.ReactNode }>) {
	return (
		<section className="rounded-xl border bg-background p-4">
			<div className="mb-2 flex items-center justify-between">
				<h2 className="text-sm font-semibold">{title}</h2>
				{aside && (
					<span className="text-sm text-muted-foreground">{aside}</span>
				)}
			</div>
			{children}
		</section>
	);
}
