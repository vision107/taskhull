import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import {
	clearQueue,
	enqueueWrite,
	isNetworkError,
	pendingChecklistFor,
	pendingStatusFor,
	readQueue,
	removeWrite,
} from "@/lib/offline/queue";

// Minimal window/localStorage so the queue module thinks it runs in a browser.
const store = new Map<string, string>();

function installBrowserGlobals() {
	const localStorage = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
	};
	const listeners = new Map<string, Set<() => void>>();
	const win = {
		localStorage,
		addEventListener: (type: string, fn: () => void) => {
			listeners.set(type, (listeners.get(type) ?? new Set()).add(fn));
		},
		removeEventListener: (type: string, fn: () => void) => {
			listeners.get(type)?.delete(fn);
		},
		dispatchEvent: (event: { type: string }) => {
			for (const fn of listeners.get(event.type) ?? []) fn();
			return true;
		},
	};
	vi.stubGlobal("window", win);
	vi.stubGlobal(
		"CustomEvent",
		class {
			type: string;
			constructor(type: string) {
				this.type = type;
			}
		},
	);
}

// Tests share one fake localStorage, so they must not run concurrently.
describe.sequential("offline write queue", () => {
	beforeAll(() => {
		installBrowserGlobals();
	});
	beforeEach(() => {
		store.clear();
		clearQueue();
	});
	afterAll(() => {
		vi.unstubAllGlobals();
	});

	it("keeps every status step in order, plus every comment and photo", () => {
		// The server enforces a state machine, so start -> blocked must replay
		// as two calls rather than being collapsed into the last one.
		enqueueWrite({
			kind: "updateStatus",
			taskId: "t1",
			input: { id: "t1", status: "in_progress" },
		});
		enqueueWrite({
			kind: "updateStatus",
			taskId: "t1",
			input: { id: "t1", status: "blocked", reason: "no parts" },
		});
		enqueueWrite({
			kind: "addComment",
			taskId: "t1",
			input: { buildTaskId: "t1", body: "a" },
		});
		enqueueWrite({
			kind: "addComment",
			taskId: "t1",
			input: { buildTaskId: "t1", body: "b" },
		});
		enqueueWrite({
			kind: "uploadPhoto",
			taskId: "t1",
			input: {
				buildTaskId: "t1",
				photoId: "p1",
				fileName: "a.jpg",
				contentType: "image/jpeg",
				sizeBytes: 10,
			},
		});
		enqueueWrite({
			kind: "uploadPhoto",
			taskId: "t1",
			input: {
				buildTaskId: "t1",
				photoId: "p2",
				fileName: "b.jpg",
				contentType: "image/jpeg",
				sizeBytes: 10,
			},
		});

		const queue = readQueue();
		expect(queue.map((item) => item.kind)).toEqual([
			"updateStatus",
			"updateStatus",
			"addComment",
			"addComment",
			"uploadPhoto",
			"uploadPhoto",
		]);
		expect(
			queue
				.filter((item) => item.kind === "updateStatus")
				.map((item) => item.kind === "updateStatus" && item.input.status),
		).toEqual(["in_progress", "blocked"]);
		const blocked = queue[1]!;
		expect(blocked.kind === "updateStatus" && blocked.input.reason).toBe(
			"no parts",
		);
	});

	it("collapses checklist ticks per item to the latest one", () => {
		enqueueWrite({
			kind: "updateChecklistItem",
			taskId: "t1",
			input: { id: "c1", status: "done" },
		});
		enqueueWrite({
			kind: "updateChecklistItem",
			taskId: "t1",
			input: { id: "c2", status: "done" },
		});
		enqueueWrite({
			kind: "updateChecklistItem",
			taskId: "t1",
			input: { id: "c1", status: "open" },
		});

		const queue = readQueue();
		expect(queue).toHaveLength(2);
		expect(
			queue.map(
				(item) =>
					item.kind === "updateChecklistItem" && [
						item.input.id,
						item.input.status,
					],
			),
		).toEqual([
			["c2", "done"],
			["c1", "open"],
		]);
	});

	it("derives the pending status and checklist ticks per task", () => {
		expect(pendingStatusFor(readQueue(), "t1")).toBeUndefined();

		enqueueWrite({
			kind: "updateStatus",
			taskId: "t1",
			input: { id: "t1", status: "in_progress" },
		});
		enqueueWrite({
			kind: "updateStatus",
			taskId: "t1",
			input: { id: "t1", status: "blocked", reason: "no parts" },
		});
		enqueueWrite({
			kind: "updateStatus",
			taskId: "t2",
			input: { id: "t2", status: "done" },
		});
		enqueueWrite({
			kind: "updateChecklistItem",
			taskId: "t1",
			input: { id: "c1", status: "done" },
		});
		enqueueWrite({
			kind: "updateChecklistItem",
			taskId: "t2",
			input: { id: "c9", status: "done" },
		});

		const queue = readQueue();
		// The last queued step is what the task will end up as.
		expect(pendingStatusFor(queue, "t1")).toBe("blocked");
		expect(pendingStatusFor(queue, "t2")).toBe("done");
		expect(pendingStatusFor(queue, "t3")).toBeUndefined();
		expect(Array.from(pendingChecklistFor(queue, "t1"))).toEqual([
			["c1", "done"],
		]);
		expect(pendingChecklistFor(queue, "t3").size).toBe(0);
	});

	it("preserves order so a photo replays before the 'done' that needs it", () => {
		enqueueWrite({
			kind: "uploadPhoto",
			taskId: "t1",
			input: {
				buildTaskId: "t1",
				photoId: "p1",
				fileName: "a.jpg",
				contentType: "image/jpeg",
				sizeBytes: 10,
			},
		});
		const done = enqueueWrite({
			kind: "updateStatus",
			taskId: "t1",
			input: { id: "t1", status: "done" },
		});
		expect(readQueue().map((item) => item.kind)).toEqual([
			"uploadPhoto",
			"updateStatus",
		]);
		removeWrite(done.id);
		expect(readQueue()).toHaveLength(1);
	});

	it("classifies fetch failures as network errors and server errors as not", () => {
		expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
		expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
		expect(
			isNetworkError(Object.assign(new Error("BAD_REQUEST"), { code: 400 })),
		).toBe(false);
		expect(isNetworkError(null)).toBe(false);
	});
});
