"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import * as React from "react";
import type { ReactCropperElement } from "react-cropper";
import Cropper from "react-cropper";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";

export type CropImageModalProps = NiceModalHocProps & {
	image: File | null;
	onCrop: (croppedImage: Blob | null) => void;
};

export const CropImageModal = NiceModal.create<CropImageModalProps>(
	({ image, onCrop }) => {
		const modal = useEnhancedModal();
		const cropperRef = React.useRef<ReactCropperElement>(null);
		const [cropperReady, setCropperReady] = React.useState(false);
		const [dialogReady, setDialogReady] = React.useState(false);
		const [imageSrc, setImageSrc] = React.useState<string | null>(null);

		const getCroppedImage = async () => {
			const cropper = cropperRef.current?.cropper;

			if (!cropper) {
				return null;
			}

			const imageBlob = await new Promise<Blob | null>((resolve) => {
				cropper
					.getCroppedCanvas({
						maxWidth: 256,
						maxHeight: 256,
					})
					.toBlob(resolve);
			});

			return imageBlob;
		};

		React.useEffect(() => {
			if (!image) {
				setImageSrc(null);
				return;
			}

			const objectUrl = URL.createObjectURL(image);
			setImageSrc(objectUrl);

			return () => URL.revokeObjectURL(objectUrl);
		}, [image]);

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={modal.handleOpenChange}
				onOpenChangeComplete={(open) => {
					setDialogReady(open);
					if (!open) {
						setCropperReady(false);
					}
					modal.handleOpenChangeComplete(open);
				}}
			>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>Crop organization logo</DialogTitle>
					</DialogHeader>
					<div className="h-80 overflow-hidden rounded-lg bg-muted">
						{dialogReady && imageSrc && (
							<Cropper
								aspectRatio={1}
								guides
								initialAspectRatio={1}
								onInitialized={() => setCropperReady(true)}
								ref={cropperRef}
								src={imageSrc}
								style={{ height: "100%", width: "100%" }}
							/>
						)}
					</div>
					<DialogFooter>
						<Button onClick={modal.handleClose} type="button" variant="outline">
							Cancel
						</Button>
						<Button
							disabled={!cropperReady}
							onClick={async () => {
								onCrop(await getCroppedImage());
								modal.handleClose();
							}}
							type="button"
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);
