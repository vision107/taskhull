"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import {
	DownloadIcon,
	FileIcon,
	PlusIcon,
	Trash2Icon,
	UploadIcon,
} from "lucide-react";
import * as React from "react";
import { useDropzone } from "react-dropzone";
import { useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { formatBytes } from "@/lib/manufacturing/format";
import {
	assertUploadAllowed,
	normalizeContentType,
	UPLOAD_LIMITS,
} from "@/lib/manufacturing/uploads";
import { trpc } from "@/trpc/client";

const formSchema = z.object({
	title: z.string().trim().min(1, "Title is required").max(200),
	phase: z.string().trim().max(80),
	durationDays: z.coerce.number().int().min(0).max(365),
	instructions: z.string().trim().max(10_000),
	requiresPhoto: z.boolean(),
	requiresComment: z.boolean(),
	checklistItems: z.array(
		z.object({
			id: z.string().optional(),
			title: z.string().trim().max(200),
		}),
	),
});
type FormValues = z.input<typeof formSchema>;

export type TemplateTaskModalProps = NiceModalHocProps & {
	templateId: string;
	versionId: string;
	/** Omit to create a new task. */
	taskId?: string;
	readOnly?: boolean;
};

export const TemplateTaskModal = NiceModal.create<TemplateTaskModalProps>(
	({ templateId, versionId, taskId: initialTaskId, readOnly = false }) => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const [taskId, setTaskId] = React.useState<string | undefined>(
			initialTaskId,
		);
		const isEditing = Boolean(taskId);

		const { data: version, isLoading } =
			trpc.organization.template.getVersion.useQuery({ versionId });
		const task = version?.tasks.find((t) => t.id === taskId);
		const siblings = (version?.tasks ?? []).filter((t) => t.id !== taskId);
		const phases = Array.from(
			new Set(
				(version?.tasks ?? [])
					.map((t) => t.phase)
					.filter((p): p is string => Boolean(p)),
			),
		);

		const invalidate = () => {
			void utils.organization.template.getVersion.invalidate({ versionId });
			void utils.organization.template.get.invalidate({ id: templateId });
		};

		const form = useZodForm({
			schema: formSchema,
			defaultValues: {
				title: "",
				phase: "",
				durationDays: 1,
				instructions: "",
				requiresPhoto: false,
				requiresComment: false,
				checklistItems: [],
			},
		});
		const checklist = useFieldArray({
			control: form.control,
			name: "checklistItems",
		});

		// Populate the form once the task is loaded (edit mode).
		const replaceChecklist = checklist.replace;
		const hydratedFor = React.useRef<string | null>(null);
		React.useEffect(() => {
			if (!task || hydratedFor.current === task.id) return;
			hydratedFor.current = task.id;
			const items = task.checklistItems.map((item) => ({
				id: item.id,
				title: item.title,
			}));
			form.reset({
				title: task.title,
				phase: task.phase ?? "",
				durationDays: task.durationDays,
				instructions: task.instructions ?? "",
				requiresPhoto: task.requiresPhoto,
				requiresComment: task.requiresComment,
				checklistItems: items,
			});
			// Keep the field array in sync with the reset values.
			replaceChecklist(items);
		}, [task, form, replaceChecklist]);

		const createMutation = trpc.organization.template.createTask.useMutation({
			onSuccess: (created) => {
				toast.success("Task added");
				invalidate();
				// Stay open in edit mode so dependencies and documents can be added.
				setTaskId(created.id);
			},
			onError: (error) => toast.error(error.message),
		});
		const updateMutation = trpc.organization.template.updateTask.useMutation({
			onError: (error) => toast.error(error.message),
		});
		const setChecklistMutation =
			trpc.organization.template.setChecklist.useMutation({
				onError: (error) => toast.error(error.message),
			});
		const addDependencyMutation =
			trpc.organization.template.addDependency.useMutation({
				onSuccess: invalidate,
				onError: (error) => toast.error(error.message),
			});
		const removeDependencyMutation =
			trpc.organization.template.removeDependency.useMutation({
				onSuccess: invalidate,
				onError: (error) => toast.error(error.message),
			});
		const uploadUrlMutation =
			trpc.organization.template.documentUploadUrl.useMutation();
		const addDocumentMutation =
			trpc.organization.template.addDocument.useMutation({
				onSuccess: invalidate,
				onError: (error) => toast.error(error.message),
			});
		const removeDocumentMutation =
			trpc.organization.template.removeDocument.useMutation({
				onSuccess: invalidate,
				onError: (error) => toast.error(error.message),
			});
		const [uploading, setUploading] = React.useState(false);

		const onSubmit = form.handleSubmit(async (values: FormValues) => {
			const parsed = formSchema.parse(values);
			const items = parsed.checklistItems.filter((item) => item.title.length);

			if (!isEditing) {
				createMutation.mutate({
					versionId,
					title: parsed.title,
					phase: parsed.phase || null,
					durationDays: parsed.durationDays,
					instructions: parsed.instructions || null,
					requiresPhoto: parsed.requiresPhoto,
					requiresComment: parsed.requiresComment,
					checklistItems: items.map((item) => item.title),
				});
				return;
			}

			if (!taskId) return;
			try {
				await updateMutation.mutateAsync({
					id: taskId,
					title: parsed.title,
					phase: parsed.phase || null,
					durationDays: parsed.durationDays,
					instructions: parsed.instructions || null,
					requiresPhoto: parsed.requiresPhoto,
					requiresComment: parsed.requiresComment,
				});
				await setChecklistMutation.mutateAsync({
					templateTaskId: taskId,
					items,
				});
				toast.success("Task saved");
				invalidate();
				modal.handleClose();
			} catch {
				// Errors surfaced by the mutations' onError handlers.
			}
		});

		const dependencyIds = new Set(
			task?.dependencies.map((dep) => dep.dependsOnTemplateTaskId) ?? [],
		);
		const toggleDependency = (dependsOnId: string, checked: boolean) => {
			if (!taskId) return;
			const input = {
				templateTaskId: taskId,
				dependsOnTemplateTaskId: dependsOnId,
			};
			if (checked) addDependencyMutation.mutate(input);
			else removeDependencyMutation.mutate(input);
		};

		const { getRootProps, getInputProps, isDragActive } = useDropzone({
			disabled: readOnly || !taskId || uploading,
			multiple: true,
			maxSize: UPLOAD_LIMITS.document.maxBytes,
			onDropRejected: (rejections) => {
				for (const rejection of rejections) {
					toast.error(
						`${rejection.file.name}: too large (max ${UPLOAD_LIMITS.document.label}).`,
					);
				}
			},
			onDrop: async (files) => {
				if (!taskId) return;
				setUploading(true);
				try {
					for (const file of files) {
						assertUploadAllowed("document", {
							fileName: file.name,
							contentType: file.type,
							sizeBytes: file.size,
						});
						const contentType = normalizeContentType(file.type);
						const { storageKey, signedUrl } =
							await uploadUrlMutation.mutateAsync({
								templateTaskId: taskId,
								fileName: file.name,
								contentType,
								sizeBytes: file.size,
							});
						const response = await fetch(signedUrl, {
							method: "PUT",
							body: file,
							headers: { "Content-Type": contentType },
						});
						if (!response.ok) {
							throw new Error(`Upload of ${file.name} failed`);
						}
						await addDocumentMutation.mutateAsync({
							templateTaskId: taskId,
							storageKey,
							fileName: file.name,
							contentType,
							sizeBytes: file.size,
						});
					}
					toast.success(
						files.length === 1
							? "Document added"
							: `${files.length} documents added`,
					);
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: "Upload failed. Is storage configured?",
					);
				} finally {
					setUploading(false);
				}
			},
		});

		const handleDownload = async (documentId: string) => {
			try {
				const { url } =
					await utils.organization.template.documentDownloadUrl.fetch({
						id: documentId,
					});
				window.open(url, "_blank", "noopener,noreferrer");
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Could not open document",
				);
			}
		};

		const isPending =
			createMutation.isPending ||
			updateMutation.isPending ||
			setChecklistMutation.isPending;

		const title = readOnly
			? (task?.title ?? "Task")
			: isEditing
				? "Edit task"
				: "New task";

		return (
			<Sheet
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<SheetContent className="sm:max-w-xl">
					<SheetHeader>
						<SheetTitle>{title}</SheetTitle>
						<SheetDescription className="sr-only">
							{isEditing
								? "Edit the task details."
								: "Add a task to the draft."}
						</SheetDescription>
					</SheetHeader>

					{isLoading || (isEditing && !task) ? (
						<div className="space-y-3 px-6 py-4">
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<Form {...form}>
							<form
								onSubmit={onSubmit}
								className="flex min-h-0 flex-1 flex-col overflow-hidden"
							>
								<ScrollArea className="min-h-0 flex-1">
									<fieldset disabled={readOnly} className="space-y-5 px-6 py-4">
										<FormField
											control={form.control}
											name="title"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>Title</FormLabel>
														<FormControl>
															<Input
																placeholder="Wire control cabinet"
																autoComplete="off"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</Field>
												</FormItem>
											)}
										/>

										<div className="grid grid-cols-2 gap-4">
											<FormField
												control={form.control}
												name="phase"
												render={({ field }) => (
													<FormItem asChild>
														<Field>
															<FormLabel>Phase</FormLabel>
															<FormControl>
																<Input
																	placeholder="Electrics"
																	autoComplete="off"
																	list="template-phases"
																	{...field}
																/>
															</FormControl>
															<datalist id="template-phases">
																{phases.map((phase) => (
																	<option key={phase} value={phase}>
																		{phase}
																	</option>
																))}
															</datalist>
															<FormMessage />
														</Field>
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="durationDays"
												render={({ field }) => (
													<FormItem asChild>
														<Field>
															<FormLabel>Duration (work days)</FormLabel>
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
										</div>

										<FormField
											control={form.control}
											name="instructions"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>Instructions for the worker</FormLabel>
														<FormControl>
															<Textarea
																placeholder="Step by step. Mention torque values, cable colours, things to watch out for."
																className="min-h-28 resize-y"
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
														htmlFor="task-requires-photo"
														className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
													>
														<span>
															<span className="font-medium">
																Photo required
															</span>
															<span className="block text-xs text-muted-foreground">
																Worker must upload a photo to finish
															</span>
														</span>
														<Switch
															id="task-requires-photo"
															checked={field.value}
															onCheckedChange={(checked) =>
																field.onChange(checked)
															}
														/>
													</label>
												)}
											/>
											<FormField
												control={form.control}
												name="requiresComment"
												render={({ field }) => (
													<label
														htmlFor="task-requires-comment"
														className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
													>
														<span>
															<span className="font-medium">
																Comment required
															</span>
															<span className="block text-xs text-muted-foreground">
																Worker must leave a note to finish
															</span>
														</span>
														<Switch
															id="task-requires-comment"
															checked={field.value}
															onCheckedChange={(checked) =>
																field.onChange(checked)
															}
														/>
													</label>
												)}
											/>
										</div>

										<Separator />

										{/* Checklist */}
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<Label>Checklist</Label>
												{!readOnly && (
													<Button
														type="button"
														variant="ghost"
														size="xs"
														onClick={() => checklist.append({ title: "" })}
													>
														<PlusIcon />
														Add item
													</Button>
												)}
											</div>
											{checklist.fields.length === 0 ? (
												<p className="text-xs text-muted-foreground">
													Optional. Small steps the worker ticks off on the
													phone.
												</p>
											) : (
												<div className="space-y-2">
													{checklist.fields.map((item, index) => (
														<div
															key={item.id}
															className="flex items-center gap-2"
														>
															<span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
																{index + 1}.
															</span>
															<FormField
																control={form.control}
																name={`checklistItems.${index}.title`}
																render={({ field }) => (
																	<Input
																		aria-label={`Checklist item ${index + 1}`}
																		placeholder="Check torque on M8 bolts"
																		autoComplete="off"
																		className="flex-1"
																		{...field}
																		value={field.value ?? ""}
																	/>
																)}
															/>
															{!readOnly && (
																<Button
																	type="button"
																	variant="ghost"
																	size="icon-xs"
																	aria-label="Remove item"
																	onClick={() => checklist.remove(index)}
																>
																	<Trash2Icon />
																</Button>
															)}
														</div>
													))}
												</div>
											)}
										</div>

										{isEditing && task && (
											<>
												<Separator />

												{/* Dependencies */}
												<div className="space-y-2">
													<Label>Depends on</Label>
													{siblings.length === 0 ? (
														<p className="text-xs text-muted-foreground">
															Add more tasks to define an order.
														</p>
													) : (
														<div className="space-y-1.5">
															{siblings.map((sibling) => {
																const checked = dependencyIds.has(sibling.id);
																return (
																	<label
																		key={sibling.id}
																		className="flex items-center gap-2 text-sm"
																	>
																		<Checkbox
																			checked={checked}
																			disabled={
																				readOnly ||
																				addDependencyMutation.isPending ||
																				removeDependencyMutation.isPending
																			}
																			onCheckedChange={(next) =>
																				toggleDependency(
																					sibling.id,
																					next === true,
																				)
																			}
																		/>
																		<span className="truncate">
																			{sibling.title}
																		</span>
																		{sibling.phase && (
																			<span className="text-xs text-muted-foreground">
																				{sibling.phase}
																			</span>
																		)}
																	</label>
																);
															})}
														</div>
													)}
												</div>

												<Separator />

												{/* Documents */}
												<div className="space-y-2">
													<Label>Documents for the worker</Label>
													{task.documents.length > 0 && (
														<ul className="divide-y rounded-lg border">
															{task.documents.map((doc) => (
																<li
																	key={doc.id}
																	className="flex items-center gap-2 px-3 py-2 text-sm"
																>
																	<FileIcon className="size-4 shrink-0 text-muted-foreground" />
																	<span className="min-w-0 flex-1 truncate">
																		{doc.fileName}
																	</span>
																	{doc.sizeBytes != null && (
																		<span className="text-xs text-muted-foreground">
																			{formatBytes(doc.sizeBytes)}
																		</span>
																	)}
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon-xs"
																		aria-label="Download"
																		onClick={() => handleDownload(doc.id)}
																	>
																		<DownloadIcon />
																	</Button>
																	{!readOnly && (
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon-xs"
																			aria-label="Remove"
																			disabled={
																				removeDocumentMutation.isPending
																			}
																			onClick={() =>
																				removeDocumentMutation.mutate({
																					id: doc.id,
																				})
																			}
																		>
																			<Trash2Icon />
																		</Button>
																	)}
																</li>
															))}
														</ul>
													)}
													{!readOnly && (
														<div
															{...getRootProps()}
															className={
																"flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-5 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40" +
																(isDragActive ? " bg-muted/60" : "")
															}
														>
															<input {...getInputProps()} />
															<UploadIcon className="size-4" />
															{uploading
																? "Uploading…"
																: `Drop drawings, PDFs or images here, or click to choose (max ${UPLOAD_LIMITS.document.label})`}
														</div>
													)}
												</div>
											</>
										)}
									</fieldset>
								</ScrollArea>

								<SheetFooter className="flex-row justify-end gap-2 border-t">
									<Button
										type="button"
										variant="outline"
										onClick={modal.handleClose}
										disabled={isPending}
									>
										{readOnly ? "Close" : "Cancel"}
									</Button>
									{!readOnly && (
										<Button
											type="submit"
											disabled={isPending}
											loading={isPending}
										>
											{isEditing ? "Save" : "Add task"}
										</Button>
									)}
								</SheetFooter>
							</form>
						</Form>
					)}
				</SheetContent>
			</Sheet>
		);
	},
);
