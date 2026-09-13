/**
 * IndexedDB store for photos taken while offline. localStorage cannot hold
 * binary data of any useful size, so the queue (see ./queue.ts) keeps only
 * the metadata and points here for the bytes.
 */

const DB_NAME = "taskhull-offline";
const DB_VERSION = 1;
const STORE = "photos";
const EVENT = "taskhull:offline-photos";

export interface StoredPhoto {
	id: string;
	taskId: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	blob: Blob;
	createdAt: number;
}

export function canUsePhotoStore(): boolean {
	return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, { keyPath: "id" });
				store.createIndex("taskId", "taskId", { unique: false });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB"));
		request.onblocked = () => reject(new Error("IndexedDB blocked"));
	});
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB"));
	});
}

async function withStore<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
	const db = await openDb();
	try {
		const tx = db.transaction(STORE, mode);
		const result = await run(tx.objectStore(STORE));
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error ?? new Error("IndexedDB"));
			tx.onabort = () => reject(tx.error ?? new Error("IndexedDB aborted"));
		});
		return result;
	} finally {
		db.close();
	}
}

function notify(): void {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(EVENT));
	}
}

export async function putPhoto(photo: StoredPhoto): Promise<void> {
	await withStore("readwrite", (store) => requestToPromise(store.put(photo)));
	notify();
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
	return withStore("readonly", (store) =>
		requestToPromise(store.get(id) as IDBRequest<StoredPhoto | undefined>),
	);
}

export async function listPhotos(taskId?: string): Promise<StoredPhoto[]> {
	const rows = await withStore("readonly", (store) =>
		taskId
			? requestToPromise(
					store.index("taskId").getAll(taskId) as IDBRequest<StoredPhoto[]>,
				)
			: requestToPromise(store.getAll() as IDBRequest<StoredPhoto[]>),
	);
	return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deletePhoto(id: string): Promise<void> {
	await withStore("readwrite", (store) => requestToPromise(store.delete(id)));
	notify();
}

export function subscribePhotos(listener: () => void): () => void {
	if (typeof window === "undefined") return () => undefined;
	window.addEventListener(EVENT, listener);
	return () => window.removeEventListener(EVENT, listener);
}
