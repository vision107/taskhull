"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface QuickAddProjectOption {
	id: string;
	name: string;
	color?: string | null;
}

interface QuickAddTaskProps {
	projectId?: string;
	projectOptions?: QuickAddProjectOption[];
	statusId?: string | null;
	startDate?: Date | null;
	dueDate?: Date | null;
	placeholder?: string;
	className?: string;
	inputClassName?: string;
	buttonLabel?: string;
	onCreated?: () => void;
}

export function QuickAddTask({
	projectId,
	projectOptions,
	statusId,
	startDate,
	dueDate,
	placeholder = "Add a task...",
	className,
	inputClassName,
	buttonLabel = "Add",
	onCreated,
}: QuickAddTaskProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const [title, setTitle] = React.useState("");
	const [selectedProjectId, setSelectedProjectId] = React.useState(
		projectId ?? projectOptions?.[0]?.id ?? "",
	);

	React.useEffect(() => {
		if (projectId) {
			setSelectedProjectId(projectId);
			return;
		}
		if (!selectedProjectId && projectOptions?.[0]) {
			setSelectedProjectId(projectOptions[0].id);
		}
	}, [projectId, projectOptions, selectedProjectId]);

	const createTask = trpc.organization.task.create.useMutation({
		onSuccess: (_task, vars) => {
			setTitle("");
			utils.organization.task.list.invalidate({ projectId: vars.projectId });
			utils.organization.task.listForOrg.invalidate();
			onCreated?.();
		},
		onError: (err) => toast.error(err.message),
	});

	const submit = (event?: React.FormEvent<HTMLFormElement>) => {
		event?.preventDefault();
		const trimmed = title.trim();
		const targetProjectId = projectId ?? selectedProjectId;
		if (!trimmed || !targetProjectId) return;

		createTask.mutate({
			projectId: targetProjectId,
			title: trimmed,
			statusId: statusId ?? undefined,
			startDate: startDate ?? undefined,
			dueDate: dueDate ?? undefined,
		});
	};

	const showProjectPicker = !projectId && (projectOptions?.length ?? 0) > 0;

	return (
		<form
			className={cn(
				"flex items-center gap-2 rounded-lg border border-dashed bg-background/70 px-2 py-1.5 transition-colors focus-within:border-primary/60 focus-within:bg-background",
				className,
			)}
			onSubmit={submit}
		>
			<PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
			<input
				className={cn(
					"min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
					inputClassName,
				)}
				disabled={createTask.isPending}
				onChange={(event) => setTitle(event.target.value)}
				placeholder={placeholder}
				value={title}
			/>
			{showProjectPicker && (
				<select
					className="max-w-44 rounded-md border bg-background px-2 py-1 text-xs outline-none"
					disabled={createTask.isPending}
					onChange={(event) => setSelectedProjectId(event.target.value)}
					value={selectedProjectId}
				>
					{projectOptions?.map((project) => (
						<option key={project.id} value={project.id}>
							{project.name}
						</option>
					))}
				</select>
			)}
			<Button
				disabled={!title.trim() || !selectedProjectId || createTask.isPending}
				size="sm"
				type="submit"
				variant="ghost"
			>
				{createTask.isPending ? (
					<Loader2Icon className="size-3.5 animate-spin" />
				) : (
					buttonLabel
				)}
			</Button>
		</form>
	);
}
