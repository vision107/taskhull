"use client";

import NiceModal, { type NiceModalHandler } from "@ebay/nice-modal-react";

export type EnhancedNiceModalHandler = NiceModalHandler & {
	handleClose: () => void;
	handleOpenChange: (value: boolean) => void;
	handleOpenChangeComplete: (value: boolean) => void;
};

export function useEnhancedModal(): EnhancedNiceModalHandler {
	const modal = NiceModal.useModal() as NiceModalHandler;
	return {
		...modal,
		handleClose: () => {
			void modal.hide();
		},
		handleOpenChange: (value) => {
			if (!value) {
				void modal.hide();
			}
		},
		handleOpenChangeComplete: (value) => {
			if (!value) {
				modal.resolveHide();
				if (!(modal.visible || modal.keepMounted)) {
					modal.remove();
				}
			}
		},
	} as EnhancedNiceModalHandler;
}
