"use client";

import NiceModal, { type NiceModalHandler } from "@ebay/nice-modal-react";
import { usePathname } from "next/navigation";
import * as React from "react";

export type EnhancedNiceModalHandler = NiceModalHandler & {
	handleClose: () => void;
	handleOpenChange: (value: boolean) => void;
	handleOpenChangeComplete: (value: boolean) => void;
	dismissForNavigation: () => void;
};

export type UseEnhancedModalOptions = {
	historyEntry?: boolean;
	blockHistoryDismiss?: boolean | (() => boolean);
};

type ModalHistoryState = {
	niceModalHistoryToken?: unknown;
};

type OpenModalEntry = {
	close: () => void;
	isDismissBlocked: () => boolean;
};

type EnhancedModalWindowState = {
	order: string[];
	byToken: Map<string, OpenModalEntry>;
	popStateListenerInstalled: boolean;
};

const ENHANCED_MODAL_STATE_KEY: unique symbol = Symbol.for(
	"achromatic.useEnhancedModal",
);

declare global {
	interface Window {
		[ENHANCED_MODAL_STATE_KEY]?: EnhancedModalWindowState;
	}
}

function isModalHistoryState(value: unknown): value is ModalHistoryState {
	return typeof value === "object" && value !== null;
}

export function readHistoryToken(value: unknown): string | null {
	if (!isModalHistoryState(value)) {
		return null;
	}

	return typeof value.niceModalHistoryToken === "string"
		? value.niceModalHistoryToken
		: null;
}

function getModalState(): EnhancedModalWindowState | null {
	if (typeof window === "undefined") {
		return null;
	}

	const existing = window[ENHANCED_MODAL_STATE_KEY];
	if (existing) {
		return existing;
	}

	const created: EnhancedModalWindowState = {
		order: [],
		byToken: new Map(),
		popStateListenerInstalled: false,
	};
	window[ENHANCED_MODAL_STATE_KEY] = created;
	return created;
}

function isOpenModalRegistered(token: string): boolean {
	return getModalState()?.byToken.has(token) ?? false;
}

function registerOpenModal(
	token: string,
	close: () => void,
	isDismissBlocked: () => boolean,
): void {
	const state = getModalState();
	if (!state) {
		return;
	}

	state.order.push(token);
	state.byToken.set(token, { close, isDismissBlocked });
}

function unregisterOpenModal(token: string): void {
	const state = getModalState();
	if (!state) {
		return;
	}

	state.byToken.delete(token);
	const index = state.order.indexOf(token);
	if (index !== -1) {
		state.order.splice(index, 1);
	}
}

function closeTokensOrRestoreOnBlock(tokens: string[]): void {
	const state = getModalState();
	if (!state) {
		return;
	}

	for (const token of tokens) {
		const entry = state.byToken.get(token);
		if (entry?.isDismissBlocked()) {
			window.history.pushState(
				{ ...window.history.state, niceModalHistoryToken: token },
				"",
			);
			return;
		}

		unregisterOpenModal(token);
		entry?.close();
	}
}

function handlePopState(event: PopStateEvent): void {
	const state = getModalState();
	if (!state) {
		return;
	}

	const landedToken = readHistoryToken(event.state);
	if (landedToken !== null && state.byToken.has(landedToken)) {
		const index = state.order.indexOf(landedToken);
		closeTokensOrRestoreOnBlock(state.order.slice(index + 1));
		return;
	}

	const lastToken = state.order.at(-1);
	if (lastToken !== undefined) {
		closeTokensOrRestoreOnBlock([lastToken]);
	}
}

function ensurePopStateListener(): void {
	const state = getModalState();
	if (!state || state.popStateListenerInstalled) {
		return;
	}

	state.popStateListenerInstalled = true;
	window.addEventListener("popstate", handlePopState);
}

export function resetEnhancedModalHistoryStateForTests(): void {
	const state = getModalState();
	if (!state) {
		return;
	}

	state.order.length = 0;
	state.byToken.clear();
}

export function getOpenModalOrderForTests(): string[] {
	return getModalState()?.order.slice() ?? [];
}

let historyTokenCounter = 0;

function createHistoryToken(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}

	historyTokenCounter += 1;
	return `modal-history-${Date.now()}-${historyTokenCounter}`;
}

export function useEnhancedModal(
	options: UseEnhancedModalOptions = {},
): EnhancedNiceModalHandler {
	const modal = NiceModal.useModal() as NiceModalHandler;
	const { historyEntry = true, blockHistoryDismiss = false } = options;
	const { visible, hide } = modal;
	const pathname = usePathname();
	const tokenRef = React.useRef<string | null>(null);
	const openPathnameRef = React.useRef<string | null>(null);
	const pendingHistoryReleaseTokenRef = React.useRef<string | null>(null);
	const hideRef = React.useRef(hide);
	const blockHistoryDismissRef = React.useRef(blockHistoryDismiss);

	React.useEffect(() => {
		hideRef.current = hide;
	}, [hide]);

	React.useEffect(() => {
		blockHistoryDismissRef.current = blockHistoryDismiss;
	}, [blockHistoryDismiss]);

	const forgetAndHide = React.useCallback(() => {
		tokenRef.current = null;
		pendingHistoryReleaseTokenRef.current = null;
		void hideRef.current();
	}, []);

	const isDismissBlocked = React.useCallback(() => {
		const value = blockHistoryDismissRef.current;
		return typeof value === "function" ? value() : value;
	}, []);

	React.useEffect(() => {
		if (!(historyEntry && visible)) {
			return;
		}

		if (tokenRef.current) {
			if (!isOpenModalRegistered(tokenRef.current)) {
				ensurePopStateListener();
				registerOpenModal(tokenRef.current, forgetAndHide, isDismissBlocked);
			}
			return;
		}

		const token = createHistoryToken();
		tokenRef.current = token;
		openPathnameRef.current = pathname;
		ensurePopStateListener();
		registerOpenModal(token, forgetAndHide, isDismissBlocked);
		window.history.pushState(
			{ ...window.history.state, niceModalHistoryToken: token },
			"",
		);
	}, [historyEntry, visible, forgetAndHide, isDismissBlocked, pathname]);

	React.useEffect(() => {
		const token = tokenRef.current;
		if (
			!token ||
			openPathnameRef.current === null ||
			openPathnameRef.current === pathname
		) {
			return;
		}

		tokenRef.current = null;
		unregisterOpenModal(token);
		void hideRef.current();
	}, [pathname]);

	React.useEffect(
		() => () => {
			const token = tokenRef.current;
			if (token) {
				unregisterOpenModal(token);
			}
		},
		[],
	);

	const closeWithHistory = React.useCallback(() => {
		const token = tokenRef.current;
		if (token) {
			tokenRef.current = null;
			unregisterOpenModal(token);
			pendingHistoryReleaseTokenRef.current =
				readHistoryToken(window.history.state) === token ? token : null;
		}
		void hideRef.current();
	}, []);

	const releaseHistoryEntryAfterClose = React.useCallback(() => {
		const token = pendingHistoryReleaseTokenRef.current;
		pendingHistoryReleaseTokenRef.current = null;
		if (!token) {
			return;
		}

		window.setTimeout(() => {
			if (readHistoryToken(window.history.state) !== token) {
				return;
			}
			const focusTarget =
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null;
			const focusTargetId = focusTarget?.id;
			const focusTargetTagName = focusTarget?.tagName.toLowerCase();
			const focusTargetIdentity =
				focusTarget?.getAttribute("aria-label") ?? focusTarget?.textContent;
			const getMatchingFocusTargets = (): HTMLElement[] =>
				focusTargetTagName
					? Array.from(
							document.querySelectorAll<HTMLElement>(focusTargetTagName),
						).filter(
							(element) =>
								(element.getAttribute("aria-label") ?? element.textContent) ===
								focusTargetIdentity,
						)
					: [];
			const focusTargetIndex = focusTarget
				? getMatchingFocusTargets().indexOf(focusTarget)
				: -1;
			const restoreFocus = (): void => {
				const activeElement = document.activeElement;
				const focusWasLost =
					activeElement === null ||
					activeElement === document.body ||
					activeElement === document.documentElement;
				// A same-URL history traversal can replace the trigger's DOM node.
				const connectedFocusTarget = focusTarget?.isConnected
					? focusTarget
					: focusTargetId
						? document.getElementById(focusTargetId)
						: focusTargetTagName && focusTargetIndex >= 0
							? getMatchingFocusTargets()[focusTargetIndex]
							: null;
				if (focusWasLost && connectedFocusTarget instanceof HTMLElement) {
					connectedFocusTarget.focus({ preventScroll: true });
				}
			};
			const restoreFocusAfterPopState = (): void => {
				window.requestAnimationFrame(restoreFocus);
			};

			window.addEventListener("popstate", restoreFocusAfterPopState, {
				once: true,
			});
			window.history.back();
			window.setTimeout(() => {
				window.removeEventListener("popstate", restoreFocusAfterPopState);
				restoreFocus();
			}, 250);
		}, 100);
	}, []);

	const dismissForNavigation = React.useCallback(() => {
		const token = tokenRef.current;
		tokenRef.current = null;
		pendingHistoryReleaseTokenRef.current = null;
		if (token) {
			unregisterOpenModal(token);
		}
		void hideRef.current();
	}, []);

	return {
		...modal,
		handleClose: closeWithHistory,
		handleOpenChange: (value) => {
			if (!value) {
				closeWithHistory();
			}
		},
		handleOpenChangeComplete: (value) => {
			if (!value) {
				modal.resolveHide();
				if (!(modal.visible || modal.keepMounted)) {
					modal.remove();
				}
				releaseHistoryEntryAfterClose();
			}
		},
		dismissForNavigation,
	} as EnhancedNiceModalHandler;
}
