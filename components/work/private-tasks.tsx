"use client";

import type { Locale } from "date-fns";
import { format, isPast, isToday, parseISO, startOfDay } from "date-fns";
import {
	AlignLeftIcon,
	CheckCircle2Icon,
	CheckIcon,
	ChevronRightIcon,
	CloudOffIcon,
	RefreshCwIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { QuickAddTask } from "@/components/manufacturing/quick-add-task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/components/work/offline-provider";
import {
	PrivateItemPeek,
	type PrivateTaskLinkOption,
} from "@/components/work/private-item-detail";
import { usePrivateItemPeek } from "@/components/work/task-peek";
import {
	overlayPrivateTaskRows,
	type PrivateTaskRow,
	usePrivateTaskActions,
} from "@/components/work/use-private-tasks";
import { useWorkLocale } from "@/components/work/work-locale-provider";
import type { WorkDictionary } from "@/lib/i18n/work";
import { isTypingTarget } from "@/lib/manufacturing/work-list";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

/**
 * Column layout, driven by the width of the list itself so columns collapse
 * when the side peek takes half the screen.
 *
 *   narrow  → name (two lines) · due
 *   @xl     → name · due · linked task
 */
const gridColumns =
	"grid grid-cols-[minmax(0,1fr)_5.5rem] @xl:grid-cols-[minmax(0,1fr)_7rem_minmax(9rem,16rem)]";

const cellBorder = "@xl:border-l @xl:border-subtle";

function privateDueLabel(
	dueDate: string | null,
	done: boolean,
	t: WorkDictionary,
	dateLocale: Locale,
): { text: string; overdue: boolean } {
	if (!dueDate) return { text: t.list.unscheduled, overdue: false };
	const due = parseISO(dueDate);
	if (isToday(due)) return { text: t.list.today, overdue: false };
	return {
		text: format(due, "d. MMM", { locale: dateLocale }),
		overdue: !done && isPast(startOfDay(due)),
	};
}

/**
 * My list with the same Asana-style shell as assigned work: full-width
 * sections on the left, `?item=` peek on `lg+`, full page on phones.
 */
export function PrivateListView(): React.JSX.Element {
	const peek = usePrivateItemPeek();
	const { data: tasks } = trpc.organization.work.myTasks.useQuery({
		includeDone: true,
	});
	const linkOptions: PrivateTaskLinkOption[] = (tasks ?? []).map((task) => ({
		id: task.id,
		label: `${task.title} · ${task.build.serialNumber}`,
	}));

	return (
		<div className="flex h-full min-h-0">
			<div className="min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto">
				<PrivateTasksList
					selectedItemId={peek.itemId}
					onOpenItem={peek.open}
					onSelectItem={peek.setItemId}
				/>
			</div>
			{peek.showPeek && peek.itemId && (
				<PrivateItemPeek
					itemId={peek.itemId}
					linkOptions={linkOptions}
					onClose={peek.close}
				/>
			)}
		</div>
	);
}

/** @deprecated Use PrivateListView. Kept so older imports keep compiling. */
export const PrivateTasksView = PrivateListView;

export function PrivateTasksList({
	selectedItemId,
	onOpenItem,
	onSelectItem,
}: {
	selectedItemId?: string | null;
	onOpenItem?: (id: string) => boolean;
	onSelectItem?: (id: string | null) => void;
}): React.JSX.Element {
	const { t } = useWorkLocale();
	const { pending } = useOffline();
	const actions = usePrivateTaskActions();
	const searchRef = React.useRef<HTMLInputElement>(null);
	const [query, setQuery] = React.useState("");
	const [collapsed, setCollapsed] = React.useState<Set<string>>(
		() => new Set(),
	);
	const { data, isLoading, isRefetching, refetch } =
		trpc.organization.privateTask.list.useQuery(
			{ includeDone: true },
			{ refetchOnWindowFocus: true },
		);

	const rows = React.useMemo(
		() => overlayPrivateTaskRows(data, pending),
		[data, pending],
	);

	const visible = React.useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((row) => {
			const hay = `${row.title} ${row.notes ?? ""} ${row.buildTask?.title ?? ""}`;
			return hay.toLowerCase().includes(needle);
		});
	}, [rows, query]);

	const open = visible.filter((row) => !row.done);
	const finished = visible.filter((row) => row.done);
	const openCount = rows.filter((row) => !row.done).length;

	const toggleSection = (key: string) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});

	usePrivateListKeyboard({
		visible,
		selectedItemId,
		onOpenItem,
		onSelectItem,
		focusSearch: () => searchRef.current?.focus(),
	});

	const handleAdd = async (title: string) => {
		const id = await actions.add(title);
		if (id) {
			onSelectItem?.(id);
			onOpenItem?.(id);
		}
	};

	if (isLoading && !data) {
		return (
			<div className="@container">
				<div className="flex h-11 items-center justify-end gap-2 px-3">
					<Skeleton className="h-7 w-28" />
				</div>
				<div className="space-y-px px-3 pt-2">
					<Skeleton className="h-9 w-40" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</div>
		);
	}

	const sections = [
		{ key: "open", title: t.privateList.open, items: open },
		{ key: "done", title: t.privateList.finished, items: finished },
	].filter((section) => section.items.length > 0);

	return (
		<div className="@container flex min-h-full flex-col">
			<div className="shrink-0 space-y-2 border-b border-subtle px-2 py-2 sm:px-3">
				<div className="flex flex-wrap items-center gap-2">
					<p className="min-w-0 flex-1 text-13 text-fg-secondary">
						{t.privateList.glance(openCount)}
						<span className="hidden sm:inline"> · {t.privateList.hint}</span>
					</p>
					<Button
						variant="ghost"
						size="icon-sm"
						className="text-fg-secondary"
						aria-label={t.list.refresh}
						onClick={() => refetch()}
						loading={isRefetching}
					>
						<RefreshCwIcon />
					</Button>
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					<Input
						ref={searchRef}
						data-task-filter=""
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t.list.searchPlaceholder}
						aria-label={t.privateList.search}
						className="h-7 w-36 border-subtle text-xs sm:w-44"
					/>
					{query && (
						<Button
							variant="ghost"
							size="xs"
							className="text-fg-secondary"
							onClick={() => setQuery("")}
						>
							{t.list.clearFilters}
						</Button>
					)}
				</div>
			</div>

			<QuickAddTask
				onAdd={handleAdd}
				placeholder={t.privateList.addPlaceholder}
				className="border-b border-subtle"
			/>

			<div
				className={cn(
					gridColumns,
					"sticky top-0 z-10 hidden h-8 shrink-0 items-center border-b border-subtle bg-surface-1 text-xs text-fg-tertiary @xl:grid",
				)}
			>
				<div className="pl-3">{t.list.columns.name}</div>
				<div className={cn(cellBorder, "px-2")}>{t.list.columns.due}</div>
				<div className={cn(cellBorder, "px-2")}>
					{t.privateList.columns.linked}
				</div>
			</div>

			{visible.length === 0 && (
				<div className="px-4 py-16 text-center">
					<CheckCircle2Icon className="mx-auto size-8 text-success" />
					<p className="mt-3 font-medium">
						{query ? t.privateList.emptyFiltered : t.privateList.empty}
					</p>
					{!query && (
						<p className="text-sm text-fg-secondary">{t.privateList.hint}</p>
					)}
				</div>
			)}

			<div className="pb-8">
				{sections.map((section) => {
					const isCollapsed = collapsed.has(section.key);
					return (
						<section key={section.key} className="pt-3">
							<button
								type="button"
								onClick={() => toggleSection(section.key)}
								aria-expanded={!isCollapsed}
								aria-label={
									isCollapsed
										? t.list.expand(section.title)
										: t.list.collapse(section.title)
								}
								className="flex h-9 w-full items-center gap-1 px-2 text-left hover:bg-layer-transparent-hover sm:px-3"
							>
								<ChevronRightIcon
									className={cn(
										"size-4 text-fg-tertiary transition-transform",
										!isCollapsed && "rotate-90",
									)}
								/>
								<span className="text-sm font-semibold">{section.title}</span>
								<span className="text-13 text-fg-tertiary tabular-nums">
									{section.items.length}
								</span>
							</button>
							{!isCollapsed && (
								<ul className="border-t border-subtle">
									{section.items.map((row) => (
										<PrivateTaskRowItem
											key={`${section.key}-${row.id}`}
											row={row}
											selected={row.id === selectedItemId}
											onOpen={onOpenItem}
											onToggle={(done) => void actions.toggle(row, done)}
										/>
									))}
								</ul>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}

function PrivateTaskRowItem({
	row,
	selected,
	onOpen,
	onToggle,
}: {
	row: PrivateTaskRow;
	selected: boolean;
	onOpen?: (id: string) => boolean;
	onToggle: (done: boolean) => void;
}): React.JSX.Element {
	const { t, dateLocale } = useWorkLocale();
	const isPending = row.pendingCreateId !== null;
	const date = privateDueLabel(row.dueDate, row.done, t, dateLocale);
	const href = `/dashboard/organization/my-list/${row.id}`;
	const linked = row.buildTask
		? `${row.buildTask.title} · ${row.buildTask.build.serialNumber}`
		: null;

	return (
		<li
			className={cn(
				gridColumns,
				"group/row relative min-h-13 items-center border-b border-subtle text-sm transition-colors @xl:min-h-9",
				selected ? "bg-layer-1" : "hover:bg-layer-transparent-hover",
				row.done && "text-fg-secondary",
				isPending && "opacity-80",
			)}
		>
			<div className="flex min-w-0 items-center gap-2 py-1.5 pr-2 pl-2 sm:pl-3 @xl:py-0">
				<button
					type="button"
					aria-label={
						row.done
							? t.privateList.markOpen
							: t.privateList.markItemDone(row.title)
					}
					aria-pressed={row.done}
					disabled={isPending}
					onClick={() => onToggle(!row.done)}
					className={cn(
						"relative z-10 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed",
						row.done
							? "border-success bg-success text-white"
							: "border-strong text-transparent hover:border-success hover:text-success",
					)}
				>
					<CheckIcon className="size-3" strokeWidth={2.5} />
				</button>
				<div className="min-w-0 flex-1">
					{isPending ? (
						<span
							className={cn(
								"block truncate leading-5",
								row.done && "line-through",
							)}
						>
							{row.title}
						</span>
					) : (
						<Link
							href={href}
							aria-label={t.list.open(row.title)}
							onClick={(event) => {
								if (!onOpen || event.metaKey || event.ctrlKey) return;
								if (onOpen(row.id)) event.preventDefault();
							}}
							className={cn(
								"block truncate leading-5 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset",
								row.done && "line-through",
							)}
						>
							{row.title}
						</Link>
					)}
					<p className="truncate text-xs text-fg-tertiary @xl:hidden">
						{linked ?? t.privateList.edit.noLink}
					</p>
				</div>
				{row.notes && (
					<AlignLeftIcon
						className="size-3.5 shrink-0 text-fg-tertiary"
						aria-hidden
					/>
				)}
				{isPending && (
					<span className="relative z-10 inline-flex items-center gap-1 text-xs text-fg-tertiary">
						<CloudOffIcon className="size-3.5" />
						{t.detail.waitingToSync}
					</span>
				)}
			</div>

			<div
				className={cn(
					cellBorder,
					"flex h-full items-center justify-end px-2 text-xs whitespace-nowrap tabular-nums @xl:justify-start @xl:text-13",
					date.overdue ? "font-medium text-warning" : "text-fg-secondary",
				)}
			>
				{date.text}
			</div>

			<div
				className={cn(
					cellBorder,
					"hidden h-full min-w-0 items-center px-2 @xl:flex",
				)}
			>
				{linked ? (
					<span className="inline-flex max-w-full items-center gap-1.5 rounded bg-layer-1 px-1.5 py-px text-xs">
						<span className="size-2 shrink-0 rounded-sm bg-primary/70" />
						<span className="truncate">{linked}</span>
					</span>
				) : (
					<span className="text-xs text-fg-tertiary">—</span>
				)}
			</div>
		</li>
	);
}

function usePrivateListKeyboard({
	visible,
	selectedItemId,
	onOpenItem,
	onSelectItem,
	focusSearch,
}: {
	visible: PrivateTaskRow[];
	selectedItemId?: string | null;
	onOpenItem?: (id: string) => boolean;
	onSelectItem?: (id: string | null) => void;
	focusSearch: () => void;
}): void {
	const visibleRef = React.useRef(visible);
	const selectedRef = React.useRef(selectedItemId);
	visibleRef.current = visible;
	selectedRef.current = selectedItemId;

	React.useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || isTypingTarget(event.target)) {
				return;
			}
			const items = visibleRef.current.filter((row) => !row.pendingCreateId);
			if (event.key === "/") {
				event.preventDefault();
				focusSearch();
				return;
			}
			if (items.length === 0) return;
			const index = Math.max(
				0,
				items.findIndex((row) => row.id === selectedRef.current),
			);
			if (event.key === "j" || event.key === "ArrowDown") {
				event.preventDefault();
				const next = items[Math.min(index + 1, items.length - 1)];
				if (next) onSelectItem?.(next.id);
				return;
			}
			if (event.key === "k" || event.key === "ArrowUp") {
				event.preventDefault();
				const next = items[Math.max(index - 1, 0)];
				if (next) onSelectItem?.(next.id);
				return;
			}
			const selected =
				items.find((row) => row.id === selectedRef.current) ?? items[0];
			if (!selected) return;
			if (event.key === "Enter") {
				event.preventDefault();
				if (!onOpenItem?.(selected.id)) {
					window.location.assign(
						`/dashboard/organization/my-list/${selected.id}`,
					);
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [focusSearch, onOpenItem, onSelectItem]);
}
