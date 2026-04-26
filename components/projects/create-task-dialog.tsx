"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AssigneePicker } from "@/components/projects/pickers/assignee-picker";
import { DatePicker } from "@/components/projects/pickers/date-picker";
import { LabelPicker } from "@/components/projects/pickers/label-picker";
import {
	PriorityPicker,
	type TaskPriorityValue,
} from "@/components/projects/pickers/priority-picker";
import { StatusPicker } from "@/components/projects/pickers/status-picker";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/trpc/client";

const schema = z.object({
	title: z.string().min(1, "Title is required").max(500),
	description: z.string().optional(),
	statusId: z.string().optional(),
	priority: z.enum(["none", "low", "medium", "high", "urgent"]),
	assigneeId: z.string().nullable().optional(),
	dueDate: z.date().nullable().optional(),
	startDate: z.date().nullable().optional(),
	labelIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateTaskDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	statuses: Array<{ id: string; name: string; color: string; type: string }>;
	parentId?: string;
	/** Pre-select a status (e.g. when opened from a kanban column). */
	defaultStatusId?: string;
}

export function CreateTaskDialog({
	open,
	onOpenChange,
	projectId,
	statuses,
	parentId,
	defaultStatusId,
}: CreateTaskDialogProps): React.JSX.Element {
	const utils = trpc.useUtils();

	const { data: project } = trpc.organization.project.get.useQuery(
		{ id: projectId },
		{ enabled: open },
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const form = useForm<FormValues>({
		resolver: zodResolver(schema) as any,
		defaultValues: {
			title: "",
			description: "",
			priority: "none",
			statusId: defaultStatusId ?? statuses.find((s) => s.type === "todo")?.id,
			assigneeId: null,
			dueDate: null,
			startDate: null,
			labelIds: [],
		},
	});

	// Re-sync defaults whenever opening the dialog with different context.
	React.useEffect(() => {
		if (!open) return;
		const todoStatus = statuses.find((s) => s.type === "todo");
		form.reset({
			title: "",
			description: "",
			priority: "none",
			statusId: defaultStatusId ?? todoStatus?.id,
			assigneeId: null,
			dueDate: null,
			startDate: null,
			labelIds: [],
		});
	}, [open, defaultStatusId, statuses, form]);

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

	const labelOptions = React.useMemo(
		() =>
			project?.labels.map((l) => ({
				id: l.id,
				name: l.name,
				color: l.color,
			})) ?? [],
		[project?.labels],
	);

	const createTask = trpc.organization.task.create.useMutation({
		onSuccess: () => {
			utils.organization.task.list.invalidate({ projectId });
			utils.organization.task.listForOrg.invalidate();
			toast.success("Task created");
			onOpenChange(false);
		},
		onError: (err) => {
			toast.error(err.message);
		},
	});

	const onSubmit = (values: FormValues) => {
		createTask.mutate({
			projectId,
			parentId: parentId ?? null,
			title: values.title,
			description: values.description
				? {
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [{ type: "text", text: values.description }],
							},
						],
					}
				: undefined,
			statusId: values.statusId,
			priority: values.priority,
			assigneeId: values.assigneeId ?? null,
			dueDate: values.dueDate ?? null,
			startDate: values.startDate ?? null,
			labelIds: values.labelIds && values.labelIds.length > 0
				? values.labelIds
				: undefined,
		});
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-[540px]">
				<DialogHeader>
					<DialogTitle>{parentId ? "Add Subtask" : "Create Task"}</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input
											autoFocus
											placeholder="Task title"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											className="resize-none text-sm"
											placeholder="What needs to be done?"
											rows={3}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-3">
							<FormField
								control={form.control}
								name="statusId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Status</FormLabel>
										<FormControl>
											<StatusPicker
												value={field.value ?? null}
												onChange={(v) => field.onChange(v ?? undefined)}
												options={statuses}
												className="w-full justify-start"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Priority</FormLabel>
										<FormControl>
											<PriorityPicker
												value={field.value as TaskPriorityValue}
												onChange={(v) => field.onChange(v)}
												className="w-full justify-start"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<FormField
								control={form.control}
								name="assigneeId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Assignee</FormLabel>
										<FormControl>
											<AssigneePicker
												value={field.value ?? null}
												onChange={(v) => field.onChange(v)}
												candidates={projectMemberCandidates}
												className="w-full justify-start"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="dueDate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Due Date</FormLabel>
										<FormControl>
											<DatePicker
												value={field.value ?? null}
												onChange={(v) => field.onChange(v)}
												placeholder="No due date"
												highlightOverdue
												className="w-full justify-start"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="labelIds"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Labels</FormLabel>
									<FormControl>
										<LabelPicker
											value={field.value ?? []}
											onChange={(v) => field.onChange(v)}
											options={labelOptions}
											className="w-full"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex justify-end gap-2 pt-2">
							<Button
								onClick={() => onOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={createTask.isPending} type="submit">
								{createTask.isPending ? (
									<Loader2Icon className="mr-2 size-4 animate-spin" />
								) : null}
								Create
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
