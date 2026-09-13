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

	it("keeps only the latest status per task but every comment and photo", () => {
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
			"addComment",
			"addComment",
			"uploadPhoto",
			"uploadPhoto",
		]);
		const status = queue[0]!;
		expect(status.kind === "updateStatus" && status.input.reason).toBe(
			"no parts",
		);
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
