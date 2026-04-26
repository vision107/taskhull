"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/trpc/client";

const schema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	description: z.string().optional(),
	startDate: z.string().optional(),
	copyTaskDates: z.boolean(),
	copyAssignees: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface CloneProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sourceProject: { id: string; name: string };
}

export function CloneProjectDialog({
	open,
	onOpenChange,
	sourceProject,
}: CloneProjectDialogProps): React.JSX.Element {
	const router = useRouter();
	const utils = trpc.useUtils();

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: `${sourceProject.name} (copy)`,
			description: "",
			startDate: "",
			copyTaskDates: false,
			copyAssignees: true,
		},
	});

	React.useEffect(() => {
		if (open) {
			form.reset({
				name: `${sourceProject.name} (copy)`,
				description: "",
				startDate: "",
				copyTaskDates: false,
				copyAssignees: true,
			});
		}
	}, [open, sourceProject.name, form]);

	const clone = trpc.organization.project.clone.useMutation({
		onSuccess: (project) => {
			utils.organization.project.list.invalidate();
			toast.success(`Cloned to ${project.name}`);
			onOpenChange(false);
			router.push(`/dashboard/organization/projects/${project.id}/list`);
		},
		onError: (err) => toast.error(err.message),
	});

	const onSubmit = (values: FormValues) => {
		clone.mutate({
			sourceProjectId: sourceProject.id,
			name: values.name,
			description: values.description || undefined,
			startDate: values.startDate ? new Date(values.startDate) : null,
			copyTaskDates: values.copyTaskDates,
			copyAssignees: values.copyAssignees,
		});
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Clone project</DialogTitle>
					<DialogDescription>
						Copies tasks, statuses, labels, and dependencies from{" "}
						<strong>{sourceProject.name}</strong>. Cloned tasks stay
						linked to the originals so you can aggregate learnings later.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						className="space-y-4"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>New project name</FormLabel>
									<FormControl>
										<Input {...field} />
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
											className="resize-none"
											placeholder="Leave blank to reuse the source description"
											rows={2}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="startDate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Start date</FormLabel>
									<FormControl>
										<Input type="date" {...field} />
									</FormControl>
									<FormDescription>
										When using "shift task dates", this is the anchor
										for the new timeline.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="copyTaskDates"
							render={({ field }) => (
								<FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
									<FormControl>
										<Checkbox
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
									<div className="space-y-1">
										<FormLabel className="cursor-pointer font-medium">
											Shift task dates
										</FormLabel>
										<FormDescription>
											Translate all source task dates by the delta between
											the old and new start dates. Otherwise, tasks are
											copied without dates.
										</FormDescription>
									</div>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="copyAssignees"
							render={({ field }) => (
								<FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
									<FormControl>
										<Checkbox
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
									<div className="space-y-1">
										<FormLabel className="cursor-pointer font-medium">
											Copy assignees
										</FormLabel>
										<FormDescription>
											Keep whoever was assigned on the source tasks.
											Uncheck to start fresh.
										</FormDescription>
									</div>
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
							<Button disabled={clone.isPending} type="submit">
								{clone.isPending ? (
									<Loader2Icon className="mr-2 size-4 animate-spin" />
								) : null}
								Clone project
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
