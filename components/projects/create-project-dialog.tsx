"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import type * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { toast } from "sonner";
import { DatePicker } from "@/components/projects/pickers/date-picker";

const schema = z
	.object({
		name: z.string().min(1, "Name is required").max(255),
		description: z.string().optional(),
		color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
		startDate: z.date().nullable().optional(),
		endDate: z.date().nullable().optional(),
	})
	.refine(
		(v) => !v.startDate || !v.endDate || v.endDate >= v.startDate,
		{ message: "End date must be on or after start date", path: ["endDate"] },
	);

type FormValues = z.infer<typeof schema>;

const PROJECT_COLORS = [
	"#6366f1",
	"#8b5cf6",
	"#ec4899",
	"#f43f5e",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#14b8a6",
	"#3b82f6",
	"#06b6d4",
];

interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({
	open,
	onOpenChange,
}: CreateProjectDialogProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: "",
			description: "",
			color: "#6366f1",
			startDate: null,
			endDate: null,
		},
	});

	const createProject = trpc.organization.project.create.useMutation({
		onSuccess: () => {
			utils.organization.project.list.invalidate();
			toast.success("Project created");
			form.reset();
			onOpenChange(false);
		},
		onError: (err) => {
			toast.error(err.message);
		},
	});

	const onSubmit = (values: FormValues) => {
		createProject.mutate({
			name: values.name,
			description: values.description,
			color: values.color,
			startDate: values.startDate ?? undefined,
			endDate: values.endDate ?? undefined,
		});
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Create Project</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="My Project" {...field} />
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
											placeholder="What is this project about?"
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
								name="startDate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Start date</FormLabel>
										<FormControl>
											<DatePicker
												onChange={field.onChange}
												placeholder="No start date"
												value={field.value ?? null}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="endDate"
								render={({ field }) => (
									<FormItem>
										<FormLabel>End date</FormLabel>
										<FormControl>
											<DatePicker
												onChange={field.onChange}
												placeholder="No end date"
												value={field.value ?? null}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="color"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Color</FormLabel>
									<FormControl>
										<div className="flex flex-wrap gap-2">
											{PROJECT_COLORS.map((color) => (
												<button
													className="h-7 w-7 rounded-full ring-offset-background transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
													key={color}
													onClick={() => field.onChange(color)}
													style={{
														backgroundColor: color,
														outline:
															field.value === color
																? `3px solid ${color}`
																: undefined,
														outlineOffset: "2px",
													}}
													type="button"
												/>
											))}
										</div>
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
							<Button disabled={createProject.isPending} type="submit">
								{createProject.isPending ? (
									<Loader2Icon className="mr-2 size-4 animate-spin" />
								) : null}
								Create Project
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
