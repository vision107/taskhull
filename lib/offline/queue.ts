/**
 * Tiny persistent write queue for the worker PWA.
 *
 * When the phone has no signal, status changes, checklist ticks, comments and
 * photos are stored here (localStorage; photo bytes live in IndexedDB, see
 * ./photo-store.ts) and replayed in order once the app is back online.
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
	  }
	| {
			id: string;
			kind: "uploadPhoto";
			taskId: string;
			/** Metadata only; the bytes are in the photo store under `photoId`. */
			input: {
				buildTaskId: string;
				photoId: string;
				fileName: string;
				contentType: string;
				sizeBytes: number;
			};
			createdAt: number;
	  }
	// Private to-dos. `taskId` carries the private task id (or, for a create,
	// the client-generated placeholder id the list shows until it is synced).
	| {
			id: string;
			kind: "createPrivateTask";
			taskId: string;
			input: { title: string };
			createdAt: number;
	  }
	| {
			id: string;
			kind: "updatePrivateTask";
			taskId: string;
			input: { id: string; done: boolean };
			createdAt: number;
	  }
	| {
			id: string;
			kind: "deletePrivateTask";
			taskId: string;
			input: { id: string };
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

	// Checklist ticks are idempotent, so only the latest one per item matters.
	// Status changes are NOT collapsed: the server enforces a state machine
	// (e.g. blocked -> in_progress -> done), so every step must be replayed in
	// the order the worker performed it.
	// Done-toggles on a private to-do are idempotent too, and deleting one
	// makes any queued toggle for it pointless.
	const deduped = queue.filter((item) => {
		if (queued.kind === "updateChecklistItem") {
			return !(
				item.kind === "updateChecklistItem" && item.input.id === queued.input.id
			);
		}
		if (
			queued.kind === "updatePrivateTask" ||
			queued.kind === "deletePrivateTask"
		) {
			return !(
				item.kind === "updatePrivateTask" && item.taskId === queued.taskId
			);
		}
		return true;
	});

	writeQueue([...deduped, queued]);
	return queued;
}

/** Private to-dos created offline that have not reached the server yet. */
export function pendingPrivateTaskCreates(
	queue: readonly QueuedWrite[],
): { id: string; title: string; createdAt: number }[] {
	const result: { id: string; title: string; createdAt: number }[] = [];
	for (const item of queue) {
		if (item.kind === "createPrivateTask") {
			result.push({
				id: item.taskId,
				title: item.input.title,
				createdAt: item.createdAt,
			});
		}
	}
	return result;
}

/**
 * Queued done-toggles per private to-do id, and the ids whose delete is still
 * waiting. Overlaid on server data so the list reflects what the worker did.
 */
export function pendingPrivateTaskChanges(queue: readonly QueuedWrite[]): {
	done: Map<string, boolean>;
	deleted: Set<string>;
} {
	const done = new Map<string, boolean>();
	const deleted = new Set<string>();
	for (const item of queue) {
		if (item.kind === "updatePrivateTask")
			done.set(item.taskId, item.input.done);
		if (item.kind === "deletePrivateTask") deleted.add(item.taskId);
	}
	return { done, deleted };
}

/**
 * The status a task will have once the queue is replayed, or `undefined` when
 * nothing is queued for it. The UI overlays this on server data so a stale
 * response (e.g. served by the service worker while the network is down)
 * cannot make a queued change disappear from the screen.
 */
export function pendingStatusFor(
	queue: readonly QueuedWrite[],
	taskId: string,
): BuildTaskStatus | undefined {
	let status: BuildTaskStatus | undefined;
	for (const item of queue) {
		if (item.kind === "updateStatus" && item.taskId === taskId) {
			status = item.input.status;
		}
	}
	return status;
}

/** Queued checklist ticks for a task, keyed by checklist item id. */
export function pendingChecklistFor(
	queue: readonly QueuedWrite[],
	taskId: string,
): Map<string, ChecklistItemStatus> {
	const result = new Map<string, ChecklistItemStatus>();
	for (const item of queue) {
		if (item.kind === "updateChecklistItem" && item.taskId === taskId) {
			result.set(item.input.id, item.input.status);
		}
	}
	return result;
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
