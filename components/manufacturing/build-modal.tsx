"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { format, parseISO } from "date-fns";
import { FilePlusIcon, FileStackIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { toDateString } from "@/lib/manufacturing/scheduling";
import { cn } from "@/lib/utils";
import { createBuildSchema } from "@/schemas/manufacturing-schemas";
import { trpc } from "@/trpc/client";

export type BuildModalProps = NiceModalHocProps & {
	/** Preselect a template (e.g. when opened from the template page). */
	templateId?: string;
};

type StartFrom = "blank" | "template";

/**
 * "New project" dialog. A project starts blank — tasks are added on the
 * project page — or from a template, in which case the template's latest
 * published version is copied and scheduled from the start date.
 */
export const BuildModal = NiceModal.create<BuildModalProps>(
	({ templateId: initialTemplateId }) => {
		const modal = useEnhancedModal();
		const router = useRouter();
		const utils = trpc.useUtils();

		const { data: templates } = trpc.organization.template.list.useQuery({
			includeArchived: false,
		});
		const usableTemplates = React.useMemo(
			() => (templates ?? []).filter((t) => t.latestPublishedVersion),
			[templates],
		);

		const [startFrom, setStartFrom] = React.useState<StartFrom>(
			initialTemplateId ? "template" : "blank",
		);

		const form = useZodForm({
			schema: createBuildSchema,
			defaultValues: {
				templateId: initialTemplateId,
				templateVersionId: undefined,
				serialNumber: "",
				name: "",
				description: "",
				plannedStartDate: toDateString(new Date()),
			},
		});

		const templateId = form.watch("templateId");
		const { data: template } = trpc.organization.template.get.useQuery(
			{ id: templateId ?? "" },
			{ enabled: startFrom === "template" && Boolean(templateId) },
		);
		const publishedVersions = React.useMemo(
			() =>
				(template?.versions ?? []).filter(
					(version) => version.status === "published",
				),
			[template],
		);
		const latestPublished = publishedVersions[0];

		// Default to the latest published version whenever the template changes.
		React.useEffect(() => {
			form.setValue("templateVersionId", latestPublished?.id);
		}, [latestPublished?.id, form]);

		const createMutation = trpc.organization.build.create.useMutation({
			onSuccess: (created) => {
				toast.success(`Project ${created.serialNumber} created`);
				void utils.organization.build.list.invalidate();
				void utils.organization.build.assignmentGrid.invalidate();
				void utils.organization.template.get.invalidate();
				void utils.organization.template.list.invalidate();
				modal.dismissForNavigation();
				router.push(`/dashboard/organization/projects/${created.id}`);
			},
			onError: (error) => toast.error(error.message),
		});

		const onSubmit = form.handleSubmit((data) => {
			const fromTemplate = startFrom === "template";
			createMutation.mutate({
				serialNumber: data.serialNumber,
				plannedStartDate: data.plannedStartDate,
				name: data.name || undefined,
				description: data.description || undefined,
				templateId: fromTemplate ? data.templateId || undefined : undefined,
				templateVersionId: fromTemplate
					? data.templateVersionId || undefined
					: undefined,
			});
		});

		const templateItems = usableTemplates.map((item) => ({
			label: item.name,
			value: item.id,
		}));
		const versionItems = publishedVersions.map((version) => ({
			label: `v${version.versionNumber}${
				version.id === latestPublished?.id ? " (latest)" : ""
			}${version.changeNote ? ` – ${version.changeNote}` : ""}`,
			value: version.id,
		}));
		const canCreate =
			startFrom === "blank" ||
			(Boolean(templateId) && publishedVersions.length > 0);

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>New project</DialogTitle>
						<DialogDescription>
							One project is one unit you build. Start blank and add tasks as
							you go, or copy the task plan from a template.
						</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={onSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label>Start from</Label>
								<div className="grid grid-cols-2 gap-2">
									<StartOption
										active={startFrom === "blank"}
										onClick={() => setStartFrom("blank")}
										icon={<FilePlusIcon className="size-4" />}
										title="Blank"
										hint="Add tasks yourself"
									/>
									<StartOption
										active={startFrom === "template"}
										onClick={() => setStartFrom("template")}
										icon={<FileStackIcon className="size-4" />}
										title="Template"
										hint={
											usableTemplates.length === 0
												? "No published templates yet"
												: `${usableTemplates.length} available`
										}
										disabled={usableTemplates.length === 0}
									/>
								</div>
							</div>

							{startFrom === "template" && (
								<>
									<FormField
										control={form.control}
										name="templateId"
										render={({ field }) => (
											<FormItem asChild>
												<Field>
													<FormLabel>Template</FormLabel>
													<Select
														items={templateItems}
														value={field.value || null}
														onValueChange={(value) =>
															field.onChange(value ?? undefined)
														}
														disabled={Boolean(initialTemplateId)}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder="Select template" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{templateItems.map((item) => (
																<SelectItem key={item.value} value={item.value}>
																	{item.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</Field>
											</FormItem>
										)}
									/>

									{templateId && publishedVersions.length > 1 && (
										<FormField
											control={form.control}
											name="templateVersionId"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>Version</FormLabel>
														<Select
															items={versionItems}
															value={field.value ?? null}
															onValueChange={(value) =>
																field.onChange(value ?? undefined)
															}
														>
															<FormControl>
																<SelectTrigger className="w-full">
																	<SelectValue placeholder="Select version" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																{versionItems.map((item) => (
																	<SelectItem
																		key={item.value}
																		value={item.value}
																	>
																		{item.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														<FormMessage />
													</Field>
												</FormItem>
											)}
										/>
									)}
								</>
							)}

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="serialNumber"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Serial / name</FormLabel>
												<FormControl>
													<Input
														placeholder="CX-2026-041"
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
									name="plannedStartDate"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Start date</FormLabel>
												<FormControl>
													<DatePicker
														className="w-full"
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
							</div>

							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Label (optional)</FormLabel>
											<FormControl>
												<Input
													placeholder="Customer or order reference"
													autoComplete="off"
													{...field}
													value={field.value ?? ""}
												/>
											</FormControl>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>

							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={modal.handleClose}
									disabled={createMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={!canCreate || createMutation.isPending}
									loading={createMutation.isPending}
								>
									Create project
								</Button>
							</DialogFooter>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		);
	},
);

function StartOption({
	active,
	onClick,
	icon,
	title,
	hint,
	disabled,
}: {
	active: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	title: string;
	hint: string;
	disabled?: boolean;
}): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={active}
			className={cn(
				"flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
				active
					? "border-foreground/40 bg-muted"
					: "border-border hover:bg-muted/50",
			)}
		>
			<span className="flex items-center gap-2 font-medium">
				{icon}
				{title}
			</span>
			<span className="text-xs text-muted-foreground">{hint}</span>
		</button>
	);
}
