"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { AlertTriangleIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
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
import { BLOCK_REASON_MAX } from "@/schemas/manufacturing-schemas";

export type BlockReasonSheetProps = NiceModalHocProps & {
	taskTitle: string;
	/** Called with the trimmed reason; the sheet closes afterwards. */
	onSubmit: (reason: string) => unknown;
	/** Optional overrides so the worker PWA can localize the copy. */
	labels?: Partial<typeof defaultLabels>;
};

const defaultLabels = {
	title: "What is blocking you?",
	description:
		"The planner gets notified right away and your note is added to the task.",
	placeholder: "e.g. bracket 4711 missing, 2 pcs",
	quick: [
		"Missing parts",
		"Waiting for previous step",
		"Machine or tool not available",
		"Drawing unclear",
	],
	cancel: "Cancel",
	submit: "Mark blocked",
};

/**
 * Bottom sheet asking for a reason before a task can be marked blocked.
 * Shared by the worker PWA and the planner task sheet.
 */
export const BlockReasonSheet = NiceModal.create<BlockReasonSheetProps>(
	({ taskTitle, onSubmit, labels: overrides }) => {
		const modal = useEnhancedModal();
		const labels = { ...defaultLabels, ...overrides };
		const [reason, setReason] = React.useState("");
		const [busy, setBusy] = React.useState(false);
		const trimmed = reason.trim();

		const submit = async () => {
			if (!trimmed || busy) return;
			setBusy(true);
			try {
				await onSubmit(trimmed.slice(0, BLOCK_REASON_MAX));
				modal.handleClose();
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
						<div className="flex items-center gap-2 text-amber-600">
							<AlertTriangleIcon className="size-4" />
							<SheetTitle className="text-base">{labels.title}</SheetTitle>
						</div>
						<SheetDescription>
							<span className="block truncate font-medium text-foreground">
								{taskTitle}
							</span>
							{labels.description}
						</SheetDescription>
					</SheetHeader>
					<form
						className="space-y-3 px-4"
						onSubmit={(event) => {
							event.preventDefault();
							void submit();
						}}
					>
						<div className="flex flex-wrap gap-2">
							{labels.quick.map((item) => (
								<button
									key={item}
									type="button"
									className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
									onClick={() =>
										setReason((current) =>
											current.trim() ? `${current.trim()} – ${item}` : item,
										)
									}
								>
									{item}
								</button>
							))}
						</div>
						<Textarea
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder={labels.placeholder}
							rows={3}
							maxLength={BLOCK_REASON_MAX}
							className="text-base"
						/>
						<SheetFooter className="flex-row gap-2 px-0 pt-1">
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
								disabled={!trimmed || busy}
								loading={busy}
							>
								{labels.submit}
							</Button>
						</SheetFooter>
					</form>
				</SheetContent>
			</Sheet>
		);
	},
);
