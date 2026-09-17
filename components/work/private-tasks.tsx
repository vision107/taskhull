"use client";

import NiceModal from "@ebay/nice-modal-react";
import type { inferRouterOutputs } from "@trpc/server";
import { format, isPast, isToday, parseISO, startOfDay } from "date-fns";
import {
	AlignLeftIcon,
	CalendarIcon,
	CloudOffIcon,
	Link2Icon,
	LockIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { QuickAddTask } from "@/components/manufacturing/quick-add-task";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/components/work/offline-provider";
import {
	type PrivateTaskLinkOption,
	PrivateTaskSheet,
	type PrivateTaskSheetValues,
} from "@/components/work/private-task-sheet";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import {
	isNetworkError,
	pendingPrivateTaskChanges,
	pendingPrivateTaskCreates,
} from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type PrivateTask =
	inferRouterOutputs<AppRouter>["organization"]["privateTask"]["list"][number];

/** A row as shown: server data with the offline queue applied on top. */
type PrivateTaskRow = Pick<
	PrivateTask,
	"id" | "title" | "notes" | "dueDate" | "buildTask"
> & {
	done: boolean;
	/** Created offline and not on the server yet; read-only until synced. */
	pendingCreateId: string | null;
};

interface PrivateTasksSectionProps {
	/** Mirrors the "show finished" toggle of the main list. */
	showDone: boolean;
	/** The caller's project tasks, offered when pinning a note to a task. */
	linkOptions: PrivateTaskLinkOption[];
}

/**
 * The member's own to-do list inside the organization, rendered under the
 * assigned tasks on "My tasks". Nobody else sees it; it lives and dies with
 * the membership. Quick add, tick off and delete work offline through the
 * write queue; editing a note needs a connection.
 */
export function PrivateTasksSection({
	showDone,
	linkOptions,
}: PrivateTasksSectionProps): React.JSX.Element {
	const { t } = useWorkLocale();
	const offline = useOffline();
	const utils = trpc.useUtils();
	const { data, isLoading } = trpc.organization.privateTask.list.useQuery(
		{ includeDone: showDone },
		{ refetchOnWindowFocus: true },
	);

	const invalidate = () =>
		void utils.organization.privateTask.list.invalidate();

	const createMutation = trpc.organization.privateTask.create.useMutation({
		onSuccess: invalidate,
	});
	const updateMutation = trpc.organization.privateTask.update.useMutation({
		onSuccess: invalidate,
	});
	const deleteMutation = trpc.organization.privateTask.delete.useMutation({
		onSuccess: invalidate,
	});

	const savedOffline = () =>
		toast(t.privateList.noteSavedOffline, {
			description: t.detail.willSyncOnline,
		});

	const add = async (title: string) => {
		try {
			await createMutation.mutateAsync({ title });
		} catch (error) {
			if (!isNetworkError(error)) {
				toast.error(error instanceof Error ? error.message : t.sync.rejected);
				throw error;
			}
			offline.enqueue({
				kind: "createPrivateTask",
				taskId: crypto.randomUUID(),
				input: { title },
			});
			savedOffline();
		}
	};

	const toggle = async (row: PrivateTaskRow, done: boolean) => {
		try {
			await updateMutation.mutateAsync({ id: row.id, done });
		} catch (error) {
			if (!isNetworkError(error)) {
				toast.error(error instanceof Error ? error.message : t.sync.rejected);
				return;
			}
			offline.enqueue({
				kind: "updatePrivateTask",
				taskId: row.id,
				input: { id: row.id, done },
			});
			savedOffline();
		}
	};

	const remove = async (row: PrivateTaskRow) => {
		try {
			await deleteMutation.mutateAsync({ id: row.id });
			toast.success(t.privateList.deleted);
		} catch (error) {
			if (!isNetworkError(error)) {
				toast.error(error instanceof Error ? error.message : t.sync.rejected);
				throw error;
			}
			offline.enqueue({
				kind: "deletePrivateTask",
				taskId: row.id,
				input: { id: row.id },
			});
			savedOffline();
		}
	};

	const save = async (row: PrivateTaskRow, values: PrivateTaskSheetValues) => {
		try {
			await updateMutation.mutateAsync({ id: row.id, ...values });
		} catch (error) {
			if (isNetworkError(error)) toast.error(t.privateList.offlineEdit);
			else
				toast.error(error instanceof Error ? error.message : t.sync.rejected);
			throw error;
		}
	};

	const openEditor = (row: PrivateTaskRow) => {
		if (row.pendingCreateId) return;
		void NiceModal.show(PrivateTaskSheet, {
			task: {
				title: row.title,
				notes: row.notes,
				dueDate: row.dueDate,
				buildTaskId: row.buildTask?.id ?? null,
				buildTask: row.buildTask
					? { id: row.buildTask.id, title: row.buildTask.title }
					: null,
			},
			linkOptions,
			labels: t.privateList.edit,
			onSave: (values) => save(row, values),
			onDelete: () => remove(row),
		});
	};

	// Overlay the offline queue: hide queued deletes, apply queued toggles and
	// show notes created offline as read-only placeholders.
	const rows = React.useMemo<PrivateTaskRow[]>(() => {
		const { done: pendingDone, deleted } = pendingPrivateTaskChanges(
			offline.pending,
		);
		const fromServer = (data ?? [])
			.filter((task) => !deleted.has(task.id))
			.map((task) => ({
				id: task.id,
				title: task.title,
				notes: task.notes,
				dueDate: task.dueDate,
				buildTask: task.buildTask,
				done: pendingDone.get(task.id) ?? task.completedAt !== null,
				pendingCreateId: null,
			}));
		const created = pendingPrivateTaskCreates(offline.pending).map(
			(pending) => ({
				id: pending.id,
				title: pending.title,
				notes: null,
				dueDate: null,
				buildTask: null,
				done: false,
				pendingCreateId: pending.id,
			}),
		);
		return [...fromServer, ...created];
	}, [data, offline.pending]);

	const open = rows.filter((row) => !row.done);
	const finished = rows.filter((row) => row.done);

	return (
		<section className="space-y-2" aria-labelledby="private-tasks-heading">
			<div className="px-1">
				<h2
					id="private-tasks-heading"
					className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
				>
					<LockIcon className="size-3.5" />
					{t.privateList.title}
					{open.length > 0 && <span>· {open.length}</span>}
				</h2>
				<p className="mt-0.5 text-xs text-muted-foreground">
					{t.privateList.hint}
				</p>
			</div>

			<div className="overflow-hidden rounded-xl border bg-background shadow-xs">
				<QuickAddTask
					onAdd={add}
					placeholder={t.privateList.addPlaceholder}
					className="border-b py-2"
				/>

				{isLoading && !data ? (
					<div className="space-y-2 p-3">
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-2/3" />
					</div>
				) : rows.length === 0 ? (
					<p className="px-4 py-6 text-center text-sm text-muted-foreground">
						{t.privateList.empty}
					</p>
				) : (
					<ul className="divide-y">
						{open.map((row) => (
							<PrivateTaskItem
								key={row.id}
								row={row}
								onToggle={(done) => void toggle(row, done)}
								onOpen={() => openEditor(row)}
							/>
						))}
					</ul>
				)}
			</div>

			{showDone && finished.length > 0 && (
				<div className="space-y-2 pt-2">
					<h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
						{t.privateList.finished} · {finished.length}
					</h3>
					<ul className="divide-y overflow-hidden rounded-xl border bg-background shadow-xs">
						{finished.map((row) => (
							<PrivateTaskItem
								key={row.id}
								row={row}
								onToggle={(done) => void toggle(row, done)}
								onOpen={() => openEditor(row)}
							/>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}

function PrivateTaskItem({
	row,
	onToggle,
	onOpen,
}: {
	row: PrivateTaskRow;
	onToggle: (done: boolean) => void;
	onOpen: () => void;
}): React.JSX.Element {
	const { t, dateLocale } = useWorkLocale();
	const isPending = row.pendingCreateId !== null;

	const due = row.dueDate ? parseISO(row.dueDate) : null;
	const dueText = due
		? isToday(due)
			? t.list.today
			: format(due, "EEE, d. MMM", { locale: dateLocale })
		: null;
	const overdue =
		due !== null && !row.done && !isToday(due) && isPast(startOfDay(due));

	return (
		<li
			className={cn(
				"flex items-start gap-3 px-4 py-3",
				row.done && "opacity-70",
				isPending && "bg-muted/30",
			)}
		>
			<Checkbox
				checked={row.done}
				disabled={isPending}
				aria-label={row.done ? t.privateList.markOpen : t.privateList.markDone}
				className="mt-1 size-5 rounded-full"
				onCheckedChange={(checked) => onToggle(checked === true)}
			/>
			<button
				type="button"
				className="min-w-0 flex-1 text-left"
				onClick={onOpen}
				disabled={isPending}
			>
				<p
					className={cn(
						"font-medium break-words",
						row.done && "text-muted-foreground line-through",
					)}
				>
					{row.title}
				</p>
				{(dueText || row.notes || row.buildTask || isPending) && (
					<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{dueText && (
							<span
								className={cn(
									"inline-flex items-center gap-1",
									overdue && "font-medium text-red-600 dark:text-red-400",
								)}
							>
								<CalendarIcon className="size-3.5" />
								{dueText}
							</span>
						)}
						{row.notes && <AlignLeftIcon className="size-3.5" />}
						{row.buildTask && (
							<span className="inline-flex min-w-0 items-center gap-1">
								<Link2Icon className="size-3.5 shrink-0" />
								<span className="truncate">
									{row.buildTask.title} · {row.buildTask.build.serialNumber}
								</span>
							</span>
						)}
						{isPending && (
							<span className="inline-flex items-center gap-1">
								<CloudOffIcon className="size-3.5" />
								{t.detail.waitingToSync}
							</span>
						)}
					</div>
				)}
			</button>
		</li>
	);
}
