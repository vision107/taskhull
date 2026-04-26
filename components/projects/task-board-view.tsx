"use client";

import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { Loader2Icon, PlusIcon } from "lucide-react";
import * as React from "react";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { TaskDetailPanel } from "@/components/projects/task-detail-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

// Priority accent is applied as a thicker coloured left border ON TOP of the
// card's default 1px border. For "none" we leave the class empty so the card
// keeps its normal left border instead of getting a 3px transparent one that
// would erase the left edge of the card.
const PRIORITY_ACCENT: Record<string, string> = {
	urgent: "border-l-[3px] border-l-red-500",
	high: "border-l-[3px] border-l-orange-500",
	medium: "border-l-[3px] border-l-yellow-500",
	low: "border-l-[3px] border-l-blue-400",
	none: "",
};

interface TaskBoardViewProps {
	projectId: string;
}

export function TaskBoardView({
	projectId,
}: TaskBoardViewProps): React.JSX.Element {
	const [createOpen, setCreateOpen] = React.useState(false);
	const [createStatusId, setCreateStatusId] = React.useState<string | undefined>();
	const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
		null,
	);
	const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
	const utils = trpc.useUtils();

	const { data: project } = trpc.organization.project.get.useQuery({
		id: projectId,
	});
	const { data: tasks, isLoading } = trpc.organization.task.list.useQuery({
		projectId,
		parentId: null,
	});

	const updateStatus = trpc.organization.task.updateStatus.useMutation({
		onSuccess: () => utils.organization.task.list.invalidate({ projectId }),
	});

	// Local optimistic-ish override so dropping a card feels instant.
	const [localStatusOverride, setLocalStatusOverride] = React.useState<
		Map<string, string | null>
	>(new Map());

	React.useEffect(() => {
		// When a new list comes in from the server, drop any overrides that now
		// match reality so we stop masking server state.
		if (!tasks) return;
		setLocalStatusOverride((prev) => {
			if (prev.size === 0) return prev;
			const next = new Map(prev);
			for (const t of tasks) {
				const override = next.get(t.id);
				if (override !== undefined && override === (t.statusId ?? null)) {
					next.delete(t.id);
				}
			}
			return next.size === prev.size ? prev : next;
		});
	}, [tasks]);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 4 },
		}),
	);

	const handleDragStart = (e: DragStartEvent) => {
		setActiveDragId(String(e.active.id));
	};

	const handleDragEnd = (e: DragEndEvent) => {
		setActiveDragId(null);
		const taskId = String(e.active.id);
		const overId = e.over?.id;
		if (!overId) return;

		const overStr = String(overId);
		// Targets can be either a column id (`col:<statusId|none>`) or a card
		// id; we only care about columns.
		if (!overStr.startsWith("col:")) return;
		const targetStatusRaw = overStr.slice(4);
		const targetStatusId = targetStatusRaw === "none" ? null : targetStatusRaw;

		const task = tasks?.find((t) => t.id === taskId);
		if (!task) return;
		if ((task.statusId ?? null) === targetStatusId) return;

		setLocalStatusOverride((prev) => {
			const next = new Map(prev);
			next.set(taskId, targetStatusId);
			return next;
		});

		updateStatus.mutate({ id: taskId, statusId: targetStatusId });
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const statuses = project?.taskStatuses ?? [];

	const resolveStatusId = (taskId: string, serverStatusId: string | null) => {
		const override = localStatusOverride.get(taskId);
		return override !== undefined ? override : serverStatusId;
	};

	const activeTask = activeDragId
		? tasks?.find((t) => t.id === activeDragId)
		: null;

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex items-center gap-2 border-b px-4 py-2">
				<Button
					onClick={() => setCreateOpen(true)}
					size="sm"
					variant="outline"
				>
					<PlusIcon className="mr-1 size-3.5" />
					Add Task
				</Button>
			</div>

			<DndContext
				sensors={sensors}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={() => setActiveDragId(null)}
			>
				<div className="flex flex-1 gap-3 overflow-x-auto p-4">
					{statuses.map((status) => {
						const columnTasks = (tasks ?? []).filter(
							(t) => resolveStatusId(t.id, t.statusId ?? null) === status.id,
						);
						return (
							<BoardColumn
								key={status.id}
								status={status}
								taskCount={columnTasks.length}
								onAddTask={() => {
									setCreateStatusId(status.id);
									setCreateOpen(true);
								}}
							>
								{columnTasks.map((task) => (
									<BoardCard
										key={task.id}
										task={task}
										onOpen={() => setSelectedTaskId(task.id)}
										isOverlay={false}
									/>
								))}
							</BoardColumn>
						);
					})}

					{/* "No status" column for tasks without a status */}
					{(() => {
						const unassigned = (tasks ?? []).filter(
							(t) => resolveStatusId(t.id, t.statusId ?? null) === null,
						);
						if (unassigned.length === 0) return null;
						return (
							<BoardColumn
								status={{
									id: "none",
									name: "No Status",
									color: "#94a3b8",
									type: "todo",
								}}
								taskCount={unassigned.length}
							>
								{unassigned.map((task) => (
									<BoardCard
										key={task.id}
										task={task}
										onOpen={() => setSelectedTaskId(task.id)}
										isOverlay={false}
									/>
								))}
							</BoardColumn>
						);
					})()}
				</div>

				<DragOverlay>
					{activeTask ? (
						<BoardCard task={activeTask} onOpen={() => {}} isOverlay />
					) : null}
				</DragOverlay>
			</DndContext>

			<CreateTaskDialog
				defaultStatusId={createStatusId}
				onOpenChange={(open) => {
					setCreateOpen(open);
					if (!open) setCreateStatusId(undefined);
				}}
				open={createOpen}
				projectId={projectId}
				statuses={statuses}
			/>

			{selectedTaskId && (
				<TaskDetailPanel
					onClose={() => setSelectedTaskId(null)}
					taskId={selectedTaskId}
				/>
			)}
		</div>
	);
}

// ─── Column ──────────────────────────────────────────────────────────────────

interface BoardColumnProps {
	status: { id: string; name: string; color: string; type: string };
	taskCount: number;
	onAddTask?: () => void;
	children: React.ReactNode;
}

function BoardColumn({
	status,
	taskCount,
	onAddTask,
	children,
}: BoardColumnProps) {
	const { setNodeRef, isOver } = useDroppable({ id: `col:${status.id}` });
	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex w-64 shrink-0 flex-col gap-2 rounded-lg p-1 transition-colors",
				isOver && "bg-primary/5 ring-1 ring-primary/30",
			)}
		>
			<div className="flex items-center justify-between px-2 pt-1">
				<div className="flex items-center gap-1.5">
					<span
						className="h-2.5 w-2.5 rounded-full"
						style={{ backgroundColor: status.color }}
					/>
					<span className="font-medium text-sm">{status.name}</span>
					<span className="text-muted-foreground text-xs">{taskCount}</span>
				</div>
				{onAddTask && (
					<button
						className="rounded p-0.5 text-muted-foreground hover:text-foreground"
						onClick={onAddTask}
						title="Add task"
						type="button"
					>
						<PlusIcon className="size-3.5" />
					</button>
				)}
			</div>

			<div className="flex min-h-10 flex-col gap-2 px-1 pb-1">{children}</div>
		</div>
	);
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface BoardCardProps {
	task: {
		id: string;
		title: string;
		priority: string;
		labels: Array<{ labelId: string; label: { name: string; color: string } }>;
		assignee: { name: string; image: string | null } | null;
		dueDate: Date | null;
	};
	onOpen: () => void;
	isOverlay: boolean;
}

function BoardCard({ task, onOpen, isOverlay }: BoardCardProps) {
	const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
		id: task.id,
		disabled: isOverlay,
	});

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (isOverlay) return;
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onOpen();
		}
	};

	return (
		<div
			ref={isOverlay ? undefined : setNodeRef}
			{...(isOverlay ? {} : listeners)}
			{...(isOverlay ? {} : attributes)}
			onClick={(e) => {
				if (isOverlay) return;
				e.stopPropagation();
				onOpen();
			}}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
			className={cn(
				"group rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md",
				PRIORITY_ACCENT[task.priority] ?? PRIORITY_ACCENT.none,
				!isOverlay && "cursor-grab active:cursor-grabbing",
				isDragging && !isOverlay && "opacity-40",
			)}
		>
			<p className="mb-2 line-clamp-2 font-medium text-sm">{task.title}</p>
			<div className="flex items-center justify-between">
				<div className="flex flex-wrap gap-1">
					{task.labels.slice(0, 2).map((tl) => (
						<span
							className="rounded-full px-1.5 py-0.5 font-medium text-[10px]"
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
				{task.assignee && (
					<Avatar className="size-5">
						<AvatarImage src={task.assignee.image ?? undefined} />
						<AvatarFallback className="text-[9px]">
							{task.assignee.name.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
				)}
			</div>
			{task.dueDate && (
				<p className="mt-1 text-[10px] text-muted-foreground">
					Due {new Date(task.dueDate).toLocaleDateString()}
				</p>
			)}
		</div>
	);
}
