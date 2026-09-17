"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { ExternalLinkIcon, StickyNoteIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import type { WorkDictionary } from "@/lib/i18n/work";
import {
	PRIVATE_TASK_NOTES_MAX,
	PRIVATE_TASK_TITLE_MAX,
} from "@/schemas/manufacturing-schemas";

export type PrivateTaskLinkOption = { id: string; label: string };

export type PrivateTaskSheetValues = {
	title: string;
	notes: string | null;
	dueDate: string | null;
	buildTaskId: string | null;
};

export type PrivateTaskSheetProps = NiceModalHocProps & {
	task: PrivateTaskSheetValues & {
		buildTask: { id: string; title: string } | null;
	};
	/** Project tasks the note can be pinned to (the caller's own tasks). */
	linkOptions: PrivateTaskLinkOption[];
	/** Resolves once saved; the sheet closes afterwards. */
	onSave: (values: PrivateTaskSheetValues) => Promise<unknown>;
	onDelete: () => Promise<unknown>;
	/** The modal renders outside the worker locale provider, so copy is passed in. */
	labels: WorkDictionary["privateList"]["edit"];
};

const NO_LINK = "__none__";

/**
 * Bottom sheet to edit one private note: title, free text, due date and an
 * optional link to a project task. Deleting lives here too so the list rows
 * stay uncluttered.
 */
export const PrivateTaskSheet = NiceModal.create<PrivateTaskSheetProps>(
	({ task, linkOptions, onSave, onDelete, labels }) => {
		const modal = useEnhancedModal();
		const [title, setTitle] = React.useState(task.title);
		const [notes, setNotes] = React.useState(task.notes ?? "");
		const [dueDate, setDueDate] = React.useState(task.dueDate ?? "");
		const [buildTaskId, setBuildTaskId] = React.useState(
			task.buildTaskId ?? NO_LINK,
		);
		const [busy, setBusy] = React.useState(false);

		// Keep a task that is linked but no longer in the caller's list
		// selectable, so opening the sheet doesn't silently drop the link.
		const options = React.useMemo(() => {
			if (
				!task.buildTask ||
				linkOptions.some((option) => option.id === task.buildTask?.id)
			) {
				return linkOptions;
			}
			return [
				{ id: task.buildTask.id, label: task.buildTask.title },
				...linkOptions,
			];
		}, [linkOptions, task.buildTask]);

		const selectItems = React.useMemo(
			() => [
				{ value: NO_LINK, label: labels.noLink },
				...options.map((option) => ({ value: option.id, label: option.label })),
			],
			[options, labels.noLink],
		);

		const trimmedTitle = title.trim();

		const save = async () => {
			if (!trimmedTitle || busy) return;
			setBusy(true);
			try {
				await onSave({
					title: trimmedTitle.slice(0, PRIVATE_TASK_TITLE_MAX),
					notes: notes.trim() ? notes.trim() : null,
					dueDate: dueDate || null,
					buildTaskId: buildTaskId === NO_LINK ? null : buildTaskId,
				});
				modal.handleClose();
			} catch {
				// The caller shows the error; keep the sheet open for a retry.
			} finally {
				setBusy(false);
			}
		};

		const remove = async () => {
			if (busy) return;
			setBusy(true);
			try {
				await onDelete();
				modal.handleClose();
			} catch {
				// See above.
			} finally {
				setBusy(false);
			}
		};

		return (
			<Sheet
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<SheetContent
					side="bottom"
					className="mx-auto w-full max-w-lg gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
				>
					<SheetHeader className="pb-2">
						<div className="flex items-center gap-2">
							<StickyNoteIcon className="size-4 text-muted-foreground" />
							<SheetTitle className="text-base">{labels.title}</SheetTitle>
						</div>
						<SheetDescription className="sr-only">
							{labels.title}
						</SheetDescription>
					</SheetHeader>
					<form
						className="space-y-4 px-4"
						onSubmit={(event) => {
							event.preventDefault();
							void save();
						}}
					>
						<div className="space-y-1.5">
							<Label htmlFor="private-task-title">{labels.titleLabel}</Label>
							<Input
								id="private-task-title"
								value={title}
								maxLength={PRIVATE_TASK_TITLE_MAX}
								onChange={(event) => setTitle(event.target.value)}
								className="text-base"
								required
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="private-task-notes">{labels.notesLabel}</Label>
							<Textarea
								id="private-task-notes"
								value={notes}
								rows={3}
								maxLength={PRIVATE_TASK_NOTES_MAX}
								placeholder={labels.notesPlaceholder}
								onChange={(event) => setNotes(event.target.value)}
								className="text-base"
							/>
						</div>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="private-task-due">{labels.dueLabel}</Label>
								<div className="flex items-center gap-2">
									<Input
										id="private-task-due"
										type="date"
										value={dueDate}
										onChange={(event) => setDueDate(event.target.value)}
										className="text-base"
									/>
									{dueDate && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => setDueDate("")}
										>
											{labels.clearDue}
										</Button>
									)}
								</div>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="private-task-link">{labels.linkLabel}</Label>
								<Select
									items={selectItems}
									value={buildTaskId}
									onValueChange={(value) => setBuildTaskId(value ?? NO_LINK)}
								>
									<SelectTrigger id="private-task-link" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{selectItems.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{buildTaskId !== NO_LINK && (
									<Link
										href={`/dashboard/work/tasks/${buildTaskId}`}
										className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
										onClick={modal.handleClose}
									>
										<ExternalLinkIcon className="size-3" />
										{labels.openTask}
									</Link>
								)}
							</div>
						</div>
						<SheetFooter className="flex-row gap-2 px-0 pt-1">
							<Button
								type="button"
								variant="outline"
								size="lg"
								className="text-destructive"
								onClick={() => void remove()}
								disabled={busy}
							>
								{labels.delete}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="lg"
								className="flex-1"
								onClick={modal.handleClose}
								disabled={busy}
							>
								{labels.cancel}
							</Button>
							<Button
								type="submit"
								size="lg"
								className="flex-1"
								disabled={!trimmedTitle || busy}
								loading={busy}
							>
								{labels.save}
							</Button>
						</SheetFooter>
					</form>
				</SheetContent>
			</Sheet>
		);
	},
);
