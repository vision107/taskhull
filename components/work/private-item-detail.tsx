"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	ArrowLeftIcon,
	CalendarIcon,
	Maximize2Icon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useOffline } from "@/components/work/offline-provider";
import {
	TaskCheckCircle,
	TaskFieldRow,
	TaskSection,
} from "@/components/work/task-layout";
import {
	type PrivateTaskValues,
	usePrivateTaskActions,
} from "@/components/work/use-private-tasks";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import { pendingPrivateTaskChanges } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";
import {
	PRIVATE_TASK_NOTES_MAX,
	PRIVATE_TASK_TITLE_MAX,
} from "@/schemas/manufacturing-schemas";
import { trpc } from "@/trpc/client";

const NO_LINK = "__none__";

export type PrivateTaskLinkOption = { id: string; label: string };

export function PrivateItemPeek({
	itemId,
	linkOptions,
	onClose,
}: {
	itemId: string;
	linkOptions: PrivateTaskLinkOption[];
	onClose: () => void;
}): React.JSX.Element {
	const { t } = useWorkLocale();
	return (
		<aside
			className="min-h-0 w-[min(44rem,50%)] shrink-0 border-l border-subtle bg-surface-1"
			aria-label={t.privateList.itemTitle}
		>
			<PrivateItemDetail
				key={itemId}
				itemId={itemId}
				variant="peek"
				linkOptions={linkOptions}
				onClose={onClose}
			/>
		</aside>
	);
}

export function PrivateItemPageView({
	itemId,
}: {
	itemId: string;
}): React.JSX.Element {
	const { data: tasks } = trpc.organization.work.myTasks.useQuery({
		includeDone: true,
	});
	const linkOptions = (tasks ?? []).map((task) => ({
		id: task.id,
		label: `${task.title} · ${task.build.serialNumber}`,
	}));

	return (
		<PrivateItemDetail
			itemId={itemId}
			variant="page"
			linkOptions={linkOptions}
		/>
	);
}

function PrivateItemDetail({
	itemId,
	variant,
	linkOptions,
	onClose,
}: {
	itemId: string;
	variant: "page" | "peek";
	linkOptions: PrivateTaskLinkOption[];
	onClose?: () => void;
}): React.JSX.Element {
	const { t } = useWorkLocale();
	const router = useRouter();
	const offline = useOffline();
	const actions = usePrivateTaskActions();
	const { data, isLoading, isError } =
		trpc.organization.privateTask.get.useQuery(
			{ id: itemId },
			{ retry: false },
		);
	const { done: pendingDone, deleted } = pendingPrivateTaskChanges(
		offline.pending,
	);

	const options = React.useMemo(() => {
		if (
			!data?.buildTask ||
			linkOptions.some((option) => option.id === data.buildTask?.id)
		) {
			return linkOptions;
		}
		return [
			{
				id: data.buildTask.id,
				label: `${data.buildTask.title} · ${data.buildTask.build.serialNumber}`,
			},
			...linkOptions,
		];
	}, [linkOptions, data?.buildTask]);

	React.useEffect(() => {
		if (!deleted.has(itemId)) return;
		if (variant === "peek") onClose?.();
		else router.replace("/dashboard/organization/my-list");
	}, [deleted, itemId, onClose, router, variant]);

	if (isLoading && !data) {
		return (
			<div className="space-y-3 px-6 py-8">
				<Skeleton className="h-8 w-2/3" />
				<Skeleton className="h-6 w-1/2" />
				<Skeleton className="h-24 w-full" />
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="px-6 py-16 text-center text-sm text-fg-secondary">
				{t.privateList.empty}
			</div>
		);
	}

	const done = pendingDone.get(data.id) ?? data.completedAt !== null;
	const isPeek = variant === "peek";

	const leaveAfterDelete = () => {
		if (isPeek) onClose?.();
		else router.replace("/dashboard/organization/my-list");
	};

	const handleDelete = () => {
		void NiceModal.show(ConfirmationModal, {
			title: t.privateList.edit.delete,
			message: data.title,
			confirmLabel: t.privateList.edit.delete,
			destructive: true,
			onConfirm: async () => {
				await actions.remove(data.id);
				leaveAfterDelete();
			},
		});
	};

	const saveField = (values: Partial<PrivateTaskValues>) =>
		actions.save(data.id, values);

	const selectItems = [
		{ value: NO_LINK, label: t.privateList.edit.noLink },
		...options.map((option) => ({ value: option.id, label: option.label })),
	];

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-subtle px-2 sm:px-3">
				{!isPeek && (
					<Link
						href="/dashboard/organization/my-list"
						aria-label={t.privateList.back}
						className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-secondary hover:bg-layer-transparent-hover md:hidden"
					>
						<ArrowLeftIcon className="size-5" />
					</Link>
				)}
				<button
					type="button"
					aria-label={
						done
							? t.privateList.markOpen
							: t.privateList.markItemDone(data.title)
					}
					aria-pressed={done}
					onClick={() => void actions.toggle(data, !done)}
					className="relative z-10"
				>
					<TaskCheckCircle done={done} />
				</button>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t.privateList.edit.delete}
						className="text-fg-secondary"
						onClick={handleDelete}
					>
						<Trash2Icon />
					</Button>
					{isPeek && (
						<>
							<Button
								variant="ghost"
								size="icon-sm"
								nativeButton={false}
								render={
									<Link href={`/dashboard/organization/my-list/${data.id}`} />
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

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-4xl px-4 pt-5 pb-10 sm:px-6">
					<InlineTitle
						value={data.title}
						done={done}
						isPeek={isPeek}
						label={t.privateList.edit.titleLabel}
						onSave={(title) => void saveField({ title })}
					/>

					<dl className="mt-4 grid grid-cols-[minmax(6rem,8rem)_1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
						<TaskFieldRow label={t.privateList.edit.dueLabel}>
							<div className="flex min-w-0 items-center gap-2">
								<CalendarIcon className="size-4 shrink-0 text-fg-tertiary" />
								<Input
									type="date"
									value={data.dueDate ?? ""}
									aria-label={t.privateList.edit.dueLabel}
									className="h-8 w-auto border-transparent bg-transparent px-1 shadow-none hover:border-border"
									onChange={(event) =>
										void saveField({
											dueDate: event.target.value || null,
										})
									}
								/>
								{data.dueDate && (
									<Button
										type="button"
										variant="ghost"
										size="xs"
										className="text-fg-secondary"
										onClick={() => void saveField({ dueDate: null })}
									>
										{t.privateList.edit.clearDue}
									</Button>
								)}
							</div>
						</TaskFieldRow>
						<TaskFieldRow label={t.privateList.edit.linkLabel}>
							<Select
								items={selectItems}
								value={data.buildTask?.id ?? NO_LINK}
								onValueChange={(value) =>
									void saveField({
										buildTaskId: value === NO_LINK || !value ? null : value,
									})
								}
							>
								<SelectTrigger className="h-8 w-full max-w-sm border-transparent bg-transparent shadow-none hover:border-border">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{selectItems.map((item) => (
										<SelectItem key={item.value} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</TaskFieldRow>
					</dl>

					{data.buildTask && (
						<Link
							href={`/dashboard/organization/tasks/${data.buildTask.id}`}
							className="mt-1 inline-flex items-center gap-1.5 text-13 text-fg-secondary hover:text-foreground"
						>
							<span className="size-2 shrink-0 rounded-sm bg-primary/70" />
							<span className="truncate">
								{data.buildTask.title} · {data.buildTask.build.serialNumber}
							</span>
							{data.buildTask.build.name ? (
								<span className="text-fg-tertiary">
									{data.buildTask.build.name}
								</span>
							) : null}
						</Link>
					)}

					<TaskSection title={t.privateList.edit.notesLabel}>
						<InlineNotes
							value={data.notes ?? ""}
							placeholder={t.privateList.edit.notesPlaceholder}
							onSave={(notes) => void saveField({ notes })}
						/>
					</TaskSection>
				</div>
			</div>
		</div>
	);
}

function InlineTitle({
	value,
	done,
	isPeek,
	label,
	onSave,
}: {
	value: string;
	done: boolean;
	isPeek: boolean;
	label: string;
	onSave: (title: string) => void;
}): React.JSX.Element {
	const [draft, setDraft] = React.useState(value);
	React.useEffect(() => setDraft(value), [value]);

	const commit = () => {
		const next = draft.trim();
		if (!next) {
			setDraft(value);
			return;
		}
		if (next !== value) onSave(next.slice(0, PRIVATE_TASK_TITLE_MAX));
	};

	return (
		<textarea
			value={draft}
			rows={1}
			maxLength={PRIVATE_TASK_TITLE_MAX}
			aria-label={label}
			className={cn(
				"-mx-1 field-sizing-content w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold tracking-tight outline-none",
				"hover:border-border focus:border-ring focus:ring-2 focus:ring-ring/30",
				done && "text-fg-secondary line-through",
				isPeek ? "text-xl" : "text-xl sm:text-2xl",
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

function InlineNotes({
	value,
	placeholder,
	onSave,
}: {
	value: string;
	placeholder: string;
	onSave: (notes: string | null) => void;
}): React.JSX.Element {
	const [draft, setDraft] = React.useState(value);
	React.useEffect(() => setDraft(value), [value]);

	return (
		<Textarea
			value={draft}
			rows={4}
			maxLength={PRIVATE_TASK_NOTES_MAX}
			placeholder={placeholder}
			aria-label={placeholder}
			className="-mx-2 min-h-24 resize-none border-transparent bg-transparent shadow-none hover:border-border"
			onChange={(event) => setDraft(event.target.value)}
			onBlur={() => {
				const next = draft.trim();
				if (next !== value.trim()) onSave(next || null);
			}}
		/>
	);
}
