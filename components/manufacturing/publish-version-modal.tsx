"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { trpc } from "@/trpc/client";

export type PublishVersionModalProps = NiceModalHocProps & {
	templateId: string;
	versionId: string;
	versionNumber: number;
	taskCount: number;
};

export const PublishVersionModal = NiceModal.create<PublishVersionModalProps>(
	({ templateId, versionId, versionNumber, taskCount }) => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const [changeNote, setChangeNote] = React.useState("");

		const publishMutation = trpc.organization.template.publish.useMutation({
			onSuccess: () => {
				toast.success(`Version ${versionNumber} published`);
				void utils.organization.template.get.invalidate({ id: templateId });
				void utils.organization.template.getVersion.invalidate({ versionId });
				void utils.organization.template.list.invalidate();
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message),
		});

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={modal.handleOpenChangeComplete}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Publish version {versionNumber}</DialogTitle>
						<DialogDescription>
							Publishing freezes this version with its {taskCount}{" "}
							{taskCount === 1 ? "task" : "tasks"}. New builds will use it;
							existing builds keep the version they were created from. To make
							further changes you create a new draft.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="change-note">What changed? (optional)</Label>
						<Textarea
							id="change-note"
							placeholder="e.g. Added safety label step after wiring"
							className="resize-none"
							rows={3}
							value={changeNote}
							onChange={(event) => setChangeNote(event.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={modal.handleClose}
							disabled={publishMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={() =>
								publishMutation.mutate({
									versionId,
									changeNote: changeNote.trim() || undefined,
								})
							}
							disabled={publishMutation.isPending}
							loading={publishMutation.isPending}
						>
							Publish
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);
