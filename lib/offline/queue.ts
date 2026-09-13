/**
 * Tiny persistent write queue for the worker PWA.
 *
 * When the phone has no signal, status changes, checklist ticks and comments
 * are stored here (localStorage) and replayed in order once the app is back
 * online. Only the three worker mutations are supported on purpose — photo
 * uploads need a live connection for the presigned PUT anyway.
 */

import type { ChecklistItemStatus } from "@/lib/db/schema/enums";
import type { BuildTaskStatus } from "@/lib/db/schema/enums";

export type QueuedWrite =
	| {
			id: string;
			kind: "updateStatus";
			taskId: string;
			input: { id: string; status: BuildTaskStatus; reason?: string };
			createdAt: number;
	  }
	| {
			id: string;
			kind: "updateChecklistItem";
			taskId: string;
			input: { id: string; status: ChecklistItemStatus };
			createdAt: number;
	  }
	| {
			id: string;
			kind: "addComment";
			taskId: string;
			input: { buildTaskId: string; body: string };
			createdAt: number;
	  };

export type QueuedWriteKind = QueuedWrite["kind"];

const STORAGE_KEY = "taskhull.offline-queue.v1";
const EVENT = "taskhull:offline-queue";

function canUseStorage(): boolean {
	return typeof window !== "undefined" && "localStorage" in window;
}

export function readQueue(): QueuedWrite[] {
	if (!canUseStorage()) return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : [];
	} catch {
		return [];
	}
}

function writeQueue(queue: QueuedWrite[]): void {
	if (!canUseStorage()) return;
	try {
		if (queue.length === 0) window.localStorage.removeItem(STORAGE_KEY);
		else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
	} finally {
		window.dispatchEvent(new CustomEvent(EVENT));
	}
}

export function enqueueWrite(
	entry: Omit<QueuedWrite, "id" | "createdAt">,
): QueuedWrite {
	const queued = {
		...entry,
		id:
			typeof crypto !== "undefined" && "randomUUID" in crypto
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		createdAt: Date.now(),
	} as QueuedWrite;

	const queue = readQueue();

	// Collapse repeated writes to the same target: only the latest status of a
	// task or checklist item matters; comments are all kept.
	const deduped =
		queued.kind === "addComment"
			? queue
			: queue.filter(
					(item) =>
						!(item.kind === queued.kind && item.input.id === queued.input.id),
				);

	writeQueue([...deduped, queued]);
	return queued;
}

export function removeWrite(id: string): void {
	writeQueue(readQueue().filter((item) => item.id !== id));
}

export function clearQueue(): void {
	writeQueue([]);
}

export function subscribeQueue(listener: () => void): () => void {
	if (typeof window === "undefined") return () => undefined;
	window.addEventListener(EVENT, listener);
	window.addEventListener("storage", listener);
	return () => {
		window.removeEventListener(EVENT, listener);
		window.removeEventListener("storage", listener);
	};
}

/**
 * True for "could not reach the server" failures (offline, DNS, aborted),
 * false for real server responses (validation errors, 403, …) which must not
 * be retried blindly.
 */
export function isNetworkError(error: unknown): boolean {
	if (typeof navigator !== "undefined" && navigator.onLine === false) {
		return true;
	}
	if (!error || typeof error !== "object") return false;

	const candidates: unknown[] = [error];
	if ("cause" in error) candidates.push((error as { cause?: unknown }).cause);

	return candidates.some((candidate) => {
		if (!candidate || typeof candidate !== "object") return false;
		const name = (candidate as { name?: unknown }).name;
		const rawMessage = (candidate as { message?: unknown }).message;
		const message = typeof rawMessage === "string" ? rawMessage : "";
		return (
			name === "TypeError" &&
			/fetch|network|load failed|connection/i.test(message)
		);
	});
}
