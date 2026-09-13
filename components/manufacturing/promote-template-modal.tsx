"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod/v4";

import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import type { PromoteDiff } from "@/lib/manufacturing/promote";
import { trpc } from "@/trpc/client";

export type PromoteTemplateModalProps = NiceModalHocProps & {
	buildId: string;
	serialNumber: string;
	/** Present when the project is already linked to a template. */
	linkedTemplate?: { id: string; name: string } | null;
	taskCount: number;
};

const saveSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(120),
	description: z.string().trim().max(2000),
});

const updateSchema = z.object({
	changeNote: z.string().trim().max(2000),
});

/**
 * Two modes:
 * - Save as template: an unlinked project becomes a new template (v1).
 * - Update template: a linked project's tasks become the next version, with a
 *   preview of what changes.
 */
export const PromoteTemplateModal = NiceModal.create<PromoteTemplateModalProps>(
	({ buildId, serialNumber, linkedTemplate, taskCount }) => {
		return linkedTemplate ? (
			<UpdateTemplate
				buildId={buildId}
				serialNumber={serialNumber}
				template={linkedTemplate}
			/>
		) : (
			<SaveAsTemplate
				buildId={buildId}
				serialNumber={serialNumber}
				taskCount={taskCount}
			/>
		);
	},
);

function SaveAsTemplate({
	buildId,
	serialNumber,
	taskCount,
}: {
	buildId: string;
	serialNumber: string;
	taskCount: number;
}): React.JSX.Element {
	const modal = useEnhancedModal();
	const router = useRouter();
	const utils = trpc.useUtils();
	const form = useZodForm({
		schema: saveSchema,
		defaultValues: { name: "", description: "" },
	});

	const mutation = trpc.organization.build.saveAsTemplate.useMutation({
		onSuccess: ({ template }) => {
			toast.success(`Template “${template.name}” created`);
			void utils.organization.build.get.invalidate({ id: buildId });
			void utils.organization.build.list.invalidate();
			void utils.organization.template.list.invalidate();
			modal.dismissForNavigation();
			router.push(`/dashboard/organization/templates/${template.id}`);
		},
		onError: (error) => toast.error(error.message),
	});

	const onSubmit = form.handleSubmit((values) => {
		mutation.mutate({
			buildId,
			name: values.name,
			description: values.description || undefined,
		});
	});

	return (
		<Dialog
			open={modal.visible}
			onOpenChange={modal.handleOpenChange}
			onOpenChangeComplete={modal.handleOpenChangeComplete}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Save as template</DialogTitle>
					<DialogDescription>
						The {taskCount} {taskCount === 1 ? "task" : "tasks"} of{" "}
						<span className="font-medium text-foreground">{serialNumber}</span>{" "}
						become version 1 of a new template. Progress, comments and photos
						stay on the project; only the plan is copied.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={onSubmit} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem asChild>
									<Field>
										<FormLabel>Template name</FormLabel>
										<FormControl>
											<Input
												placeholder="Conveyor CX-200"
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
							name="description"
							render={({ field }) => (
								<FormItem asChild>
									<Field>
										<FormLabel>Description (optional)</FormLabel>
										<FormControl>
											<Textarea
												placeholder="What this plan is for"
												className="min-h-20 resize-y"
												{...field}
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
								disabled={mutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={taskCount === 0 || mutation.isPending}
								loading={mutation.isPending}
							>
								Create template
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

function UpdateTemplate({
	buildId,
	serialNumber,
	template,
}: {
	buildId: string;
	serialNumber: string;
	template: { id: string; name: string };
}): React.JSX.Element {
	const modal = useEnhancedModal();
	const utils = trpc.useUtils();
	const { data: preview, isLoading } =
		trpc.organization.build.templateDiff.useQuery({ buildId });
	const form = useZodForm({
		schema: updateSchema,
		defaultValues: { changeNote: "" },
	});

	const mutation = trpc.organization.build.updateTemplate.useMutation({
		onSuccess: ({ version }) => {
			toast.success(`${template.name} v${version.versionNumber} published`);
			void utils.organization.build.get.invalidate({ id: buildId });
			void utils.organization.build.list.invalidate();
			void utils.organization.template.get.invalidate({ id: template.id });
			void utils.organization.template.list.invalidate();
			modal.handleClose();
		},
		onError: (error) => toast.error(error.message),
	});

	const onSubmit = form.handleSubmit((values) => {
		mutation.mutate({ buildId, changeNote: values.changeNote || undefined });
	});

	const diff = preview?.diff;
	const changed = diff
		? diff.added.length + diff.updated.length + diff.removed.length
		: 0;
	const blocked = preview?.openDraftVersionNumber != null;

	return (
		<Dialog
			open={modal.visible}
			onOpenChange={modal.handleOpenChange}
			onOpenChangeComplete={modal.handleOpenChangeComplete}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Update template from project</DialogTitle>
					<DialogDescription>
						The tasks of{" "}
						<span className="font-medium text-foreground">{serialNumber}</span>{" "}
						become{" "}
						<span className="font-medium text-foreground">
							{template.name}
							{preview ? ` v${preview.nextVersionNumber}` : ""}
						</span>
						. Other open projects can then be upgraded to it.
					</DialogDescription>
				</DialogHeader>

				{isLoading || !diff ? (
					<div className="space-y-2">
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-3/4" />
					</div>
				) : (
					<DiffSummary
						diff={diff}
						baselineVersionNumber={preview.baselineVersionNumber}
					/>
				)}

				{blocked && (
					<p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
						The template has an open draft (v{preview?.openDraftVersionNumber}
						). Publish or discard it on the template page first.
					</p>
				)}

				<Form {...form}>
					<form onSubmit={onSubmit} className="space-y-4">
						<FormField
							control={form.control}
							name="changeNote"
							render={({ field }) => (
								<FormItem asChild>
									<Field>
										<FormLabel>What changed (optional)</FormLabel>
										<FormControl>
											<Textarea
												placeholder={`Learned on ${serialNumber}`}
												className="min-h-16 resize-y"
												{...field}
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
								disabled={mutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									isLoading || changed === 0 || blocked || mutation.isPending
								}
								loading={mutation.isPending}
							>
								Publish v{preview?.nextVersionNumber ?? "…"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

function DiffSummary({
	diff,
	baselineVersionNumber,
}: {
	diff: PromoteDiff;
	baselineVersionNumber: number;
}): React.JSX.Element {
	const total = diff.added.length + diff.updated.length + diff.removed.length;
	if (total === 0) {
		return (
			<p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
				The template (v{baselineVersionNumber}) already matches this project.
				Nothing to publish.
			</p>
		);
	}
	return (
		<div className="space-y-2 rounded-lg border px-3 py-2 text-sm">
			<p className="text-xs text-muted-foreground">
				Compared with v{baselineVersionNumber} · {diff.unchanged} unchanged
			</p>
			<DiffGroup label="Added" tone="text-emerald-600" items={diff.added} />
			<DiffGroup
				label="Changed"
				tone="text-amber-600"
				items={diff.updated.map((item) => ({
					title: item.title,
					detail: item.fields.join(", "),
				}))}
			/>
			<DiffGroup label="Removed" tone="text-red-600" items={diff.removed} />
		</div>
	);
}

function DiffGroup({
	label,
	tone,
	items,
}: {
	label: string;
	tone: string;
	items: { title: string; detail?: string }[];
}): React.JSX.Element | null {
	if (items.length === 0) return null;
	return (
		<div>
			<p className={`text-xs font-medium ${tone}`}>
				{label} ({items.length})
			</p>
			<ul className="mt-0.5 space-y-0.5">
				{items.map((item, index) => (
					<li key={`${item.title}-${index}`} className="flex gap-2">
						<span className="truncate">{item.title}</span>
						{item.detail && (
							<span className="shrink-0 text-xs text-muted-foreground">
								{item.detail}
							</span>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}
