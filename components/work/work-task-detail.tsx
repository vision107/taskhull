"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
	ArrowLeftIcon,
	CalendarIcon,
	CameraIcon,
	CheckIcon,
	DownloadIcon,
	FileIcon,
	ImageIcon,
	ListTreeIcon,
	LockIcon,
	Maximize2Icon,
	PlayIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user/user-avatar";
import { BlockReasonSheet } from "@/components/work/block-reason-sheet";
import { useOffline } from "@/components/work/offline-provider";
import {
	TaskCheckCircle,
	TaskFieldRow,
	TaskSection,
} from "@/components/work/task-layout";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import { useSession } from "@/hooks/use-session";
import type {
	BuildTaskStatus,
	ChecklistItemStatus,
} from "@/lib/db/schema/enums";
import type { WorkDictionary } from "@/lib/i18n/work";
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
import {
	isNetworkError,
	pendingChecklistFor,
	pendingStatusFor,
	removeWrite,
} from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export interface WorkTaskDetailProps {
	taskId: string;
	/**
	 * `page` is the full route; `peek` is the side pane next to a list and gets
	 * a close button plus a link to the full page instead of a back arrow.
	 */
	variant?: "page" | "peek";
	onClose?: () => void;
}

export function WorkTaskDetail({
	taskId,
	variant = "page",
	onClose,
}: WorkTaskDetailProps): React.JSX.Element {
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
	// Comments waiting to sync, plus block reasons (the server turns those into
	// comments as well), in the order they were written.
	const pendingComments = offline.pending.flatMap((item) => {
		if (item.taskId !== taskId) return [];
		if (item.kind === "addComment") {
			return [{ id: item.id, body: item.input.body }];
		}
		if (item.kind === "updateStatus" && item.input.reason) {
			return [{ id: item.id, body: item.input.reason }];
		}
		return [];
	});
	const pendingStatus = pendingStatusFor(offline.pending, taskId);
	const pendingChecklist = pendingChecklistFor(offline.pending, taskId);

	const invalidate = () => {
		void utils.organization.work.getTask.invalidate({ id: taskId });
		void utils.organization.work.myTasks.invalidate();
	};

	// -- offline fallbacks ----------------------------------------------------
	// When there is no connection the change is stored in the write queue and
	// the provider replays it once the phone is back online. The screen reads
	// the queued values on top of the server data (see `pendingStatus` and
	// `pendingChecklist`), so a stale response — e.g. the service worker
	// serving its last cached copy while the network is down — cannot make a
	// queued change disappear from the screen.

	const queueStatus = (next: BuildTaskStatus, reason?: string) => {
		offline.enqueue({
			kind: "updateStatus",
			taskId,
			input: { id: taskId, status: next, reason },
		});
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
			<div className="flex h-full flex-col">
				<div className="flex h-12 items-center gap-2 border-b border-subtle px-4">
					<Skeleton className="h-7 w-28" />
					<Skeleton className="h-7 w-20" />
				</div>
				<div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-6 sm:px-6">
					<Skeleton className="h-8 w-2/3" />
					<Skeleton className="h-5 w-1/2" />
					<Skeleton className="h-5 w-1/3" />
					<Skeleton className="mt-6 h-32 w-full" />
				</div>
			</div>
		);
	}

	// Queued (not yet synced) changes win over what the server last told us.
	const status = pendingStatus ?? (task.status as BuildTaskStatus);
	const checklistItems = task.checklistItems.map((item) => {
		const queued = pendingChecklist.get(item.id);
		return queued === undefined ? item : { ...item, status: queued };
	});
	const canEdit = task.canEdit;
	const blocked = task.blockers.length > 0;
	const openChecklist = checklistItems.filter(
		(item) => item.status === "open",
	).length;
	// A photo or comment waiting in the offline queue counts: it is replayed
	// before any queued "done" so the server-side check passes as well.
	const missingPhoto =
		task.requiresPhoto &&
		task.uploads.length === 0 &&
		pendingPhotos.length === 0;
	const missingComment =
		task.requiresComment &&
		task.comments.length === 0 &&
		pendingComments.length === 0;
	const openSubtasks = task.subtasks.filter(
		(subtask) => subtask.status !== "done",
	).length;
	// Mirrors the server-side checks for "done" that the worker can see here.
	const canFinish = !blocked && openSubtasks === 0;
	const finishHints = [
		openSubtasks > 0 ? t.detail.finishSubtasksFirst : null,
		missingPhoto ? t.detail.addPhoto : null,
		missingComment ? t.detail.leaveComment : null,
	].filter((part): part is string => Boolean(part));

	const busy = statusMutation.isPending;
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

	const isPeek = variant === "peek";
	const projectName =
		task.build.templateVersion?.template.name ?? task.build.name ?? "Project";
	const attachmentCount =
		task.documents.length + task.uploads.length + pendingPhotos.length;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Action bar: the primary action lives at the top like in Asana, so
			    it reads the same on a phone and inside the side peek. */}
			<div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-subtle px-2 sm:px-3">
				{!isPeek && (
					<Link
						href="/dashboard/organization/my-tasks"
						aria-label={t.detail.back}
						className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-secondary hover:bg-layer-transparent-hover md:hidden"
					>
						<ArrowLeftIcon className="size-5" />
					</Link>
				)}
				{canEdit ? (
					<TaskActions
						status={status}
						busy={busy}
						canFinish={canFinish}
						labels={t.detail}
						onSetStatus={setStatus}
						onBlock={askBlockReason}
					/>
				) : (
					<TaskStatusBadge status={status} labels={t.status} />
				)}
				<div className="ml-auto flex shrink-0 items-center gap-1">
					{canEdit && (
						<TaskStatusBadge
							status={status}
							labels={t.status}
							className="hidden sm:inline-flex"
						/>
					)}
					{isPeek && (
						<>
							<Button
								variant="ghost"
								size="icon-sm"
								nativeButton={false}
								render={
									<Link href={`/dashboard/organization/tasks/${task.id}`} />
								}
								aria-label={t.detail.openFullPage}
								className="text-fg-secondary"
							>
								<Maximize2Icon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t.detail.close}
								className="text-fg-secondary"
								onClick={onClose}
							>
								<XIcon />
							</Button>
						</>
					)}
				</div>
			</div>

			{/* Banners: state the reader has to know before acting. */}
			{blocked && (
				<div className="flex shrink-0 items-start gap-2 border-b border-subtle bg-warning-soft px-4 py-2.5 text-13 text-warning sm:px-6">
					<LockIcon className="mt-0.5 size-4 shrink-0" />
					<p>
						<span className="font-medium">{t.detail.waitingOn}</span>{" "}
						{task.blockers.map((blocker) => blocker.title).join(", ")}
					</p>
				</div>
			)}
			{!blocked &&
				canEdit &&
				(status === "todo" || status === "in_progress") &&
				finishHints.length > 0 && (
					<div className="shrink-0 border-b border-subtle bg-layer-1 px-4 py-2 text-13 text-fg-secondary sm:px-6">
						{t.detail.beforeFinishing(finishHints)}
					</div>
				)}
			{!task.isAssigned && (
				<div className="flex shrink-0 items-center gap-2 border-b border-subtle bg-layer-1 px-4 py-2 text-13 text-fg-secondary sm:px-6">
					<LockIcon className="size-3.5 shrink-0" />
					{canEdit ? t.detail.viewingAsPlanner : t.detail.viewOnly}
				</div>
			)}

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-10 sm:px-6">
					{task.parent && (
						<Link
							href={`/dashboard/organization/tasks/${task.parent.id}`}
							className="mb-1 inline-flex max-w-full items-center gap-1 text-13 text-fg-tertiary hover:text-foreground"
						>
							<ListTreeIcon className="size-3.5 shrink-0" />
							<span className="truncate">{task.parent.title}</span>
						</Link>
					)}
					<h1
						className={cn(
							"font-semibold tracking-tight",
							status === "done" && "text-fg-secondary line-through",
							isPeek ? "text-xl" : "text-xl sm:text-2xl",
						)}
					>
						{task.title}
					</h1>

					{/* Field rows, label left / value right like Asana's task pane. */}
					<dl className="mt-4 grid grid-cols-[minmax(6rem,8rem)_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
						<TaskFieldRow label={t.detail.assignees}>
							{task.assignments.length === 0 ? (
								<span className="text-fg-tertiary">{t.detail.unassigned}</span>
							) : (
								<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
									{task.assignments.map((assignment) => (
										<span
											key={assignment.id}
											className="inline-flex items-center gap-1.5"
										>
											<UserAvatar
												name={assignment.user.name}
												src={assignment.user.image}
												className="size-6"
												fallbackClassName="text-[10px]"
											/>
											<span className="truncate">{assignment.user.name}</span>
										</span>
									))}
								</span>
							)}
						</TaskFieldRow>
						<TaskFieldRow label={t.detail.due}>
							{task.startDate ? (
								<span className="inline-flex items-center gap-1.5">
									<CalendarIcon className="size-4 text-fg-tertiary" />
									{format(parseISO(task.startDate), "EEE, d. MMM", {
										locale: dateLocale,
									})}
									<span className="text-fg-tertiary">
										· {t.detail.days(task.plannedDurationDays)}
										{task.plannedHours != null &&
											` · ${t.detail.hours(task.plannedHours)}`}
									</span>
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 text-fg-tertiary">
									<CalendarIcon className="size-4" />
									{t.detail.unscheduled}
								</span>
							)}
						</TaskFieldRow>
						<TaskFieldRow label={t.detail.project}>
							<Link
								href={`/dashboard/organization/projects/${task.build.id}`}
								className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-layer-1 px-2 py-0.5 text-13 hover:bg-layer-1-hover"
							>
								<span className="size-2 shrink-0 rounded-sm bg-primary/70" />
								<span className="truncate">{projectName}</span>
								<span className="shrink-0 text-fg-tertiary">
									{task.build.serialNumber}
								</span>
							</Link>
						</TaskFieldRow>
						{task.phase && (
							<TaskFieldRow label={t.detail.phase}>{task.phase}</TaskFieldRow>
						)}
					</dl>

					{/* Instructions */}
					<TaskSection title={t.detail.instructions}>
						{task.instructions ? (
							<p className="text-sm leading-relaxed whitespace-pre-wrap">
								{task.instructions}
							</p>
						) : (
							<p className="text-sm text-fg-placeholder">
								{t.detail.noInstructions}
							</p>
						)}
					</TaskSection>

					{/* Checklist */}
					{checklistItems.length > 0 && (
						<TaskSection
							title={t.detail.checklist}
							count={`${checklistItems.length - openChecklist} / ${checklistItems.length}`}
						>
							<ul className="-mx-2 divide-y divide-subtle">
								{checklistItems.map((item) => {
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
													checklistMutation.mutate({
														id: item.id,
														status: next,
													});
												}}
												className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left hover:bg-layer-transparent-hover disabled:opacity-70 disabled:hover:bg-transparent"
											>
												<TaskCheckCircle done={done} className="mt-0.5" />
												<span className="min-w-0 flex-1">
													<span
														className={cn(
															"block text-sm",
															done && "text-fg-tertiary line-through",
														)}
													>
														{item.title}
													</span>
													{done && item.completedBy && (
														<span className="block text-xs text-fg-tertiary">
															{item.completedBy.name}
														</span>
													)}
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						</TaskSection>
					)}

					{/* Subtasks: each is its own task; this one is confirmed by hand */}
					{task.subtasks.length > 0 && (
						<TaskSection
							title={t.detail.subtasks}
							count={`${task.subtasks.length - openSubtasks} / ${task.subtasks.length}`}
						>
							<ul className="-mx-2 divide-y divide-subtle">
								{task.subtasks.map((subtask) => (
									<li key={subtask.id}>
										<Link
											href={`/dashboard/organization/tasks/${subtask.id}`}
											className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-layer-transparent-hover"
										>
											<TaskCheckCircle done={subtask.status === "done"} />
											<span
												className={cn(
													"min-w-0 flex-1 truncate",
													subtask.status === "done" &&
														"text-fg-tertiary line-through",
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
															className="size-5 ring-1 ring-surface-1"
															fallbackClassName="text-[9px]"
														/>
													))}
												</span>
											)}
											<TaskStatusBadge
												status={subtask.status}
												labels={t.status}
											/>
										</Link>
									</li>
								))}
							</ul>
						</TaskSection>
					)}

					{/* Attachments: template documents, photos, queued uploads. */}
					{(attachmentCount > 0 || canEdit) && (
						<TaskSection
							title={t.detail.attachments}
							count={attachmentCount > 0 ? String(attachmentCount) : undefined}
							aside={
								task.requiresPhoto ? (
									<RequirementTag
										missing={missingPhoto}
										label={
											missingPhoto ? t.detail.required : t.detail.requiredDone
										}
									/>
								) : undefined
							}
						>
							{attachmentCount > 0 && (
								<ul className="-mx-2 divide-y divide-subtle">
									{task.documents.map((doc) => (
										<li key={doc.id}>
											<button
												type="button"
												onClick={() => download(doc.id)}
												className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-layer-transparent-hover"
											>
												<FileIcon className="size-4 shrink-0 text-fg-tertiary" />
												<span className="min-w-0 flex-1 truncate text-sm">
													{doc.fileName}
												</span>
												<span className="shrink-0 text-xs text-fg-tertiary">
													{doc.sizeBytes != null && formatBytes(doc.sizeBytes)}
												</span>
												<DownloadIcon className="size-4 shrink-0 text-fg-tertiary" />
											</button>
										</li>
									))}
									{task.uploads.map((upload) => (
										<li
											key={upload.id}
											className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-layer-transparent-hover"
										>
											<button
												type="button"
												onClick={() => download(upload.id)}
												className="flex min-w-0 flex-1 items-center gap-3 text-left"
											>
												<ImageIcon className="size-4 shrink-0 text-fg-tertiary" />
												<span className="min-w-0 flex-1">
													<span className="block truncate text-sm">
														{upload.fileName}
													</span>
													<span className="block text-xs text-fg-tertiary">
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
									{pendingPhotos.map((item) => (
										<li
											key={item.id}
											className="flex items-center gap-3 px-2 py-2 opacity-70"
										>
											<ImageIcon className="size-4 shrink-0 text-fg-tertiary" />
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm">
													{item.input.fileName}
												</span>
												<span className="block text-xs text-fg-tertiary">
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
													void deletePhoto(item.input.photoId).catch(
														() => undefined,
													);
												}}
											>
												<XIcon />
											</Button>
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
										size="sm"
										className={cn("mt-2", attachmentCount === 0 && "mt-0")}
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
						</TaskSection>
					)}

					{/* Comments / activity */}
					<Tabs defaultValue="comments" className="mt-8 gap-3">
						<div className="flex items-center justify-between gap-2 border-b border-subtle">
							<TabsList variant="line" className="h-9">
								<TabsTrigger value="comments">
									{t.detail.comments}
									{task.comments.length > 0 && (
										<span className="ml-1 text-fg-tertiary">
											{task.comments.length}
										</span>
									)}
								</TabsTrigger>
								<TabsTrigger value="activity">{t.detail.activity}</TabsTrigger>
							</TabsList>
							{task.requiresComment && (
								<RequirementTag
									missing={missingComment}
									label={
										missingComment ? t.detail.required : t.detail.requiredDone
									}
								/>
							)}
						</div>
						<TabsContent value="comments">
							{task.comments.length + pendingComments.length > 0 && (
								<ul className="mb-4 space-y-4">
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
													<span className="text-xs text-fg-tertiary">
														{formatDistanceToNow(item.createdAt, {
															addSuffix: true,
															locale: dateLocale,
														})}
													</span>
													{item.authorId === currentUserId && (
														<button
															type="button"
															className="ml-auto text-fg-tertiary hover:text-destructive"
															aria-label={t.detail.deleteComment}
															onClick={() =>
																deleteCommentMutation.mutate({ id: item.id })
															}
														>
															<Trash2Icon className="size-3.5" />
														</button>
													)}
												</div>
												<CommentBody
													body={item.body}
													currentUserId={currentUserId}
												/>
											</div>
										</li>
									))}
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
													<span className="text-sm font-medium">
														{user?.name}
													</span>
													<span className="text-xs text-fg-tertiary">
														{t.detail.waitingToSync}
													</span>
												</div>
												<CommentBody
													body={item.body}
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
						</TabsContent>
						<TabsContent value="activity">
							<ActivityTimeline buildTaskId={task.id} limit={30} compact />
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}

/** The status transitions a worker can trigger, rendered as compact buttons. */
function TaskActions({
	status,
	busy,
	canFinish,
	labels,
	onSetStatus,
	onBlock,
}: {
	status: BuildTaskStatus;
	busy: boolean;
	canFinish: boolean;
	labels: WorkDictionary["detail"];
	onSetStatus: (next: BuildTaskStatus) => void;
	onBlock: () => void;
}): React.JSX.Element {
	const blockButton = (
		<Button
			variant="ghost"
			size="sm"
			className="text-fg-secondary"
			onClick={onBlock}
			disabled={busy}
		>
			<LockIcon />
			<span className="hidden sm:inline">{labels.blocked}</span>
		</Button>
	);

	if (status === "todo") {
		return (
			<>
				{/* Short jobs are often finished before anyone presses start, so
				    "done" is offered right away as well. */}
				<Button
					size="sm"
					onClick={() => onSetStatus("in_progress")}
					disabled={busy}
					loading={busy}
				>
					<PlayIcon />
					{labels.start}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onSetStatus("done")}
					disabled={busy || !canFinish}
				>
					<CheckIcon />
					{labels.markDone}
				</Button>
				{blockButton}
			</>
		);
	}
	if (status === "in_progress") {
		return (
			<>
				<Button
					size="sm"
					onClick={() => onSetStatus("done")}
					disabled={busy || !canFinish}
					loading={busy}
				>
					<CheckIcon />
					{labels.markDone}
				</Button>
				{blockButton}
			</>
		);
	}
	if (status === "blocked") {
		return (
			<Button
				size="sm"
				onClick={() => onSetStatus("in_progress")}
				disabled={busy}
				loading={busy}
			>
				<PlayIcon />
				{labels.resume}
			</Button>
		);
	}
	if (status === "review") {
		return (
			<>
				<Button
					size="sm"
					onClick={() => onSetStatus("done")}
					disabled={busy}
					loading={busy}
				>
					<CheckIcon />
					{labels.markDone}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onSetStatus("in_progress")}
					disabled={busy}
				>
					{labels.reopen}
				</Button>
			</>
		);
	}
	return (
		<Button
			variant="outline"
			size="sm"
			className="border-success/40 text-success hover:text-success"
			onClick={() => onSetStatus("in_progress")}
			disabled={busy}
			loading={busy}
		>
			<CheckIcon />
			{labels.reopen}
		</Button>
	);
}

function RequirementTag({
	missing,
	label,
}: {
	missing: boolean;
	label: string;
}): React.JSX.Element {
	return (
		<span
			className={cn("text-xs", missing ? "text-destructive" : "text-success")}
		>
			{label}
		</span>
	);
}
