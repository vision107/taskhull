"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { format, parseISO } from "date-fns";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/custom/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { trpc } from "@/trpc/client";

const formSchema = z.object({
	title: z.string().trim().min(1, "Give the task a name").max(200),
	phase: z.string().trim().max(80),
	instructions: z.string().trim().max(10_000),
	startDate: z.string(),
	plannedDurationDays: z.coerce.number().int().min(0).max(365),
	/** Empty string = not set. */
	plannedHours: z.union([z.literal(""), z.coerce.number().min(0).max(10_000)]),
	requiresPhoto: z.boolean(),
	requiresComment: z.boolean(),
	dependsOnIds: z.array(z.string()),
});

export type BuildTaskModalTask = {
	id: string;
	title: string;
	phase: string | null;
	instructions: string | null;
	startDate: string | null;
	plannedDurationDays: number;
	plannedHours: number | null;
	requiresPhoto: boolean;
	requiresComment: boolean;
	dependencies: { dependsOnBuildTaskId: string }[];
};

export type BuildTaskModalProps = NiceModalHocProps & {
	buildId: string;
	/** Other tasks of the build, offered as "after" dependencies. */
	siblings: { id: string; title: string; phase: string | null }[];
	/** Edit mode when set. */
	task?: BuildTaskModalTask;
	/** Preselect a phase (when adding from a phase group). */
	defaultPhase?: string | null;
};

/**
 * Planner-side add/edit of a single build task. Tasks created here are
 * "ad-hoc": they belong to this unit only and are left alone by template
 * upgrades.
 */
export const BuildTaskModal = NiceModal.create<BuildTaskModalProps>(
	({ buildId, siblings, task, defaultPhase }) => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const isEditing = Boolean(task);

		const form = useZodForm({
			schema: formSchema,
			defaultValues: {
				title: task?.title ?? "",
				phase: task?.phase ?? defaultPhase ?? "",
				instructions: task?.instructions ?? "",
				startDate: task?.startDate ?? "",
				plannedDurationDays: task?.plannedDurationDays ?? 1,
				plannedHours: task?.plannedHours ?? "",
				requiresPhoto: task?.requiresPhoto ?? false,
				requiresComment: task?.requiresComment ?? false,
				dependsOnIds:
					task?.dependencies.map((d) => d.dependsOnBuildTaskId) ?? [],
			},
		});

		const invalidate = () => {
			void utils.organization.build.get.invalidate({ id: buildId });
			void utils.organization.build.list.invalidate();
			void utils.organization.build.assignmentGrid.invalidate();
			if (task) {
				void utils.organization.work.getTask.invalidate({ id: task.id });
			}
			void utils.organization.work.activity.invalidate();
		};

		const createMutation = trpc.organization.build.createTask.useMutation({
			onSuccess: (created) => {
				toast.success(`Task "${created.title}" added`);
				invalidate();
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message),
		});
		const updateMutation = trpc.organization.build.updateTask.useMutation({
			onSuccess: () => {
				toast.success("Task updated");
				invalidate();
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message),
		});
		const pending = createMutation.isPending || updateMutation.isPending;

		const onSubmit = form.handleSubmit((values) => {
			const data = formSchema.parse(values);
			const common = {
				title: data.title,
				phase: data.phase || null,
				instructions: data.instructions || null,
				plannedDurationDays: data.plannedDurationDays,
				plannedHours: data.plannedHours === "" ? null : data.plannedHours,
				requiresPhoto: data.requiresPhoto,
				requiresComment: data.requiresComment,
				dependsOnIds: data.dependsOnIds,
			};
			if (task) {
				updateMutation.mutate({
					id: task.id,
					...common,
					startDate: data.startDate || null,
				});
			} else {
				createMutation.mutate({
					buildId,
					...common,
					phase: common.phase ?? undefined,
					instructions: common.instructions ?? undefined,
					startDate: data.startDate || undefined,
				});
			}
		});

		const candidates = siblings.filter((s) => s.id !== task?.id);

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{isEditing ? "Edit task" : "Add task"}</DialogTitle>
						<DialogDescription>
							{isEditing
								? "Changes apply to this unit only."
								: "An extra task for this unit only. Template upgrades leave it untouched."}
						</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={onSubmit} className="space-y-4">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Title</FormLabel>
											<FormControl>
												<Input
													placeholder="Replace damaged bolt on frame"
													autoComplete="off"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>

							<div className="grid gap-4 sm:grid-cols-2">
								<FormField
									control={form.control}
									name="phase"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Phase</FormLabel>
												<FormControl>
													<Input
														placeholder="Mechanics"
														autoComplete="off"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="startDate"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Start</FormLabel>
												<FormControl>
													<DatePicker
														className="w-full"
														dateFormat="PP"
														placeholder={
															isEditing ? "Pick a date" : "Automatic"
														}
														date={
															field.value ? parseISO(field.value) : undefined
														}
														onDateChange={(date) =>
															field.onChange(
																date ? format(date, "yyyy-MM-dd") : "",
															)
														}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="plannedDurationDays"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Duration (days)</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														max={365}
														inputMode="numeric"
														{...field}
														value={
															typeof field.value === "number" ||
															typeof field.value === "string"
																? field.value
																: ""
														}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="plannedHours"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Effort (hours)</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={0}
														step={0.5}
														inputMode="decimal"
														placeholder="optional"
														{...field}
														value={
															typeof field.value === "number" ||
															typeof field.value === "string"
																? field.value
																: ""
														}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="instructions"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Instructions</FormLabel>
											<FormControl>
												<Textarea
													rows={4}
													placeholder="What the worker needs to know."
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>

							<div className="grid gap-3 sm:grid-cols-2">
								<FormField
									control={form.control}
									name="requiresPhoto"
									render={({ field }) => (
										<label
											htmlFor="build-task-requires-photo"
											className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
										>
											<span>
												<span className="font-medium">Photo required</span>
												<span className="block text-xs text-muted-foreground">
													Worker must upload a photo to finish
												</span>
											</span>
											<Switch
												id="build-task-requires-photo"
												checked={field.value}
												onCheckedChange={(checked) => field.onChange(checked)}
											/>
										</label>
									)}
								/>
								<FormField
									control={form.control}
									name="requiresComment"
									render={({ field }) => (
										<label
											htmlFor="build-task-requires-comment"
											className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
										>
											<span>
												<span className="font-medium">Comment required</span>
												<span className="block text-xs text-muted-foreground">
													Worker must leave a note to finish
												</span>
											</span>
											<Switch
												id="build-task-requires-comment"
												checked={field.value}
												onCheckedChange={(checked) => field.onChange(checked)}
											/>
										</label>
									)}
								/>
							</div>

							{candidates.length > 0 && (
								<FormField
									control={form.control}
									name="dependsOnIds"
									render={({ field }) => {
										const selected = new Set(field.value);
										return (
											<div className="space-y-2">
												<Label>Can only start after</Label>
												<div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border p-2">
													{candidates.map((sibling) => (
														<label
															key={sibling.id}
															className="flex items-center gap-2 text-sm"
														>
															<Checkbox
																checked={selected.has(sibling.id)}
																onCheckedChange={(next) => {
																	const copy = new Set(field.value);
																	if (next === true) copy.add(sibling.id);
																	else copy.delete(sibling.id);
																	field.onChange(Array.from(copy));
																}}
															/>
															<span className="truncate">{sibling.title}</span>
															{sibling.phase && (
																<span className="text-xs text-muted-foreground">
																	{sibling.phase}
																</span>
															)}
														</label>
													))}
												</div>
											</div>
										);
									}}
								/>
							)}

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={modal.handleClose}
									disabled={pending}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={pending} loading={pending}>
									{isEditing ? "Save" : "Add task"}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		);
	},
);
