"use client";

import * as React from "react";
import { toast } from "sonner";

import { useWorkT } from "@/components/work/work-locale-provider";
import { deletePhoto, getPhoto } from "@/lib/offline/photo-store";
import {
	enqueueWrite,
	isNetworkError,
	type QueuedWrite,
	readQueue,
	removeWrite,
	subscribeQueue,
} from "@/lib/offline/queue";
import { trpc } from "@/trpc/client";

interface OfflineContextValue {
	online: boolean;
	pending: QueuedWrite[];
	syncing: boolean;
	/** Persist a write for later and return it. */
	enqueue: typeof enqueueWrite;
	/** Try to replay the queue now. */
	flush: () => Promise<void>;
	/** Web push state for the header toggle. */
	push: {
		supported: boolean;
		enabled: boolean;
		subscribed: boolean;
		busy: boolean;
		toggle: () => Promise<void>;
	};
}

const OfflineContext = React.createContext<OfflineContextValue | null>(null);

export function useOffline(): OfflineContextValue {
	const value = React.useContext(OfflineContext);
	if (!value) {
		throw new Error("useOffline must be used inside <OfflineProvider>");
	}
	return value;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(normalized);
	const output = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
	return output;
}

/**
 * Registers the service worker, tracks connectivity, replays queued writes
 * when the connection returns and owns the push subscription lifecycle.
 * Mounted once in the worker layout.
 */
export function OfflineProvider({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	const utils = trpc.useUtils();
	const t = useWorkT();
	const [online, setOnline] = React.useState(true);
	const [pending, setPending] = React.useState<QueuedWrite[]>([]);
	const [syncing, setSyncing] = React.useState(false);
	const flushing = React.useRef(false);

	const registration = React.useRef<ServiceWorkerRegistration | null>(null);
	const [pushSubscribed, setPushSubscribed] = React.useState(false);
	const [pushBusy, setPushBusy] = React.useState(false);
	const pushSupported =
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window;

	const { data: pushConfig } = trpc.notification.pushConfig.useQuery(
		undefined,
		{ staleTime: Infinity },
	);
	const subscribeMutation = trpc.notification.subscribePush.useMutation();
	const unsubscribeMutation = trpc.notification.unsubscribePush.useMutation();

	// -- connectivity & queue ------------------------------------------------

	React.useEffect(() => {
		setOnline(navigator.onLine);
		setPending(readQueue());
		const onOnline = () => setOnline(true);
		const onOffline = () => setOnline(false);
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		const unsubscribe = subscribeQueue(() => setPending(readQueue()));
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
			unsubscribe();
		};
	}, []);

	const flush = React.useCallback(async () => {
		if (flushing.current || !navigator.onLine) return;
		const queue = readQueue();
		if (queue.length === 0) return;

		flushing.current = true;
		setSyncing(true);
		const touchedTasks = new Set<string>();
		let synced = 0;
		let dropped = 0;

		try {
			for (const item of queue) {
				try {
					switch (item.kind) {
						case "updateStatus":
							await utils.client.organization.work.updateStatus.mutate(
								item.input,
							);
							break;
						case "updateChecklistItem":
							await utils.client.organization.work.updateChecklistItem.mutate(
								item.input,
							);
							break;
						case "addComment":
							await utils.client.organization.work.addComment.mutate(
								item.input,
							);
							break;
						case "uploadPhoto": {
							const stored = await getPhoto(item.input.photoId);
							if (!stored) {
								// Bytes are gone (storage evicted) – nothing we can replay.
								throw new Error(t.sync.photoLost(item.input.fileName));
							}
							const { storageKey, signedUrl } =
								await utils.client.organization.work.attachmentUploadUrl.mutate(
									{
										buildTaskId: item.input.buildTaskId,
										fileName: item.input.fileName,
										contentType: item.input.contentType,
										sizeBytes: item.input.sizeBytes,
									},
								);
							const response = await fetch(signedUrl, {
								method: "PUT",
								body: stored.blob,
								headers: { "Content-Type": item.input.contentType },
							});
							if (!response.ok) {
								throw new Error(
									t.sync.uploadFailed(item.input.fileName, response.status),
								);
							}
							await utils.client.organization.work.addAttachment.mutate({
								buildTaskId: item.input.buildTaskId,
								storageKey,
								fileName: item.input.fileName,
								contentType: item.input.contentType,
								sizeBytes: item.input.sizeBytes,
							});
							await deletePhoto(item.input.photoId).catch(() => undefined);
							break;
						}
						case "createPrivateTask":
							await utils.client.organization.privateTask.create.mutate(
								item.input,
							);
							break;
						case "updatePrivateTask":
							await utils.client.organization.privateTask.update.mutate(
								item.input,
							);
							break;
						case "deletePrivateTask":
							await utils.client.organization.privateTask.delete.mutate(
								item.input,
							);
							break;
					}
					removeWrite(item.id);
					touchedTasks.add(item.taskId);
					synced++;
				} catch (error) {
					if (isNetworkError(error)) {
						// Still offline — stop and keep the rest for later.
						break;
					}
					// The server rejected it (e.g. blocker not done anymore). Drop it
					// and tell the worker rather than retrying forever.
					removeWrite(item.id);
					if (item.kind === "uploadPhoto") {
						void deletePhoto(item.input.photoId).catch(() => undefined);
					}
					touchedTasks.add(item.taskId);
					dropped++;
					toast.error(error instanceof Error ? error.message : t.sync.rejected);
				}
			}
		} finally {
			flushing.current = false;
			setSyncing(false);
			if (touchedTasks.size > 0) {
				for (const taskId of touchedTasks) {
					void utils.organization.work.getTask.invalidate({ id: taskId });
				}
				void utils.organization.work.myTasks.invalidate();
				void utils.organization.work.activity.invalidate();
				void utils.organization.privateTask.list.invalidate();
			}
			if (synced > 0) {
				toast.success(t.sync.synced(synced));
			}
			if (dropped > 0 && synced === 0) {
				// error toasts already shown
			}
		}
	}, [utils, t]);

	React.useEffect(() => {
		if (online) void flush();
	}, [online, flush]);

	React.useEffect(() => {
		const onVisible = () => {
			if (document.visibilityState === "visible") void flush();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, [flush]);

	// -- service worker & push ------------------------------------------------

	React.useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		let cancelled = false;
		navigator.serviceWorker
			.register("/sw.js", { scope: "/" })
			.then(async (reg) => {
				if (cancelled) return;
				registration.current = reg;
				if ("pushManager" in reg) {
					const existing = await reg.pushManager.getSubscription();
					if (!cancelled) setPushSubscribed(Boolean(existing));
				}
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	const togglePush = React.useCallback(async () => {
		if (!pushSupported || !pushConfig?.enabled || !pushConfig.publicKey) {
			return;
		}
		setPushBusy(true);
		try {
			const reg = registration.current ?? (await navigator.serviceWorker.ready);
			registration.current = reg;
			const existing = await reg.pushManager.getSubscription();

			if (existing) {
				await unsubscribeMutation.mutateAsync({ endpoint: existing.endpoint });
				await existing.unsubscribe();
				setPushSubscribed(false);
				toast.success(t.sync.pushOff);
				return;
			}

			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				toast.error(t.sync.pushBlocked);
				return;
			}
			const subscription = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
			});
			const json = subscription.toJSON();
			if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
				throw new Error(t.sync.pushIncomplete);
			}
			await subscribeMutation.mutateAsync({
				endpoint: json.endpoint,
				keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
				userAgent: navigator.userAgent,
			});
			setPushSubscribed(true);
			toast.success(t.sync.pushOn);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t.sync.pushFailed);
		} finally {
			setPushBusy(false);
		}
	}, [pushSupported, pushConfig, subscribeMutation, unsubscribeMutation, t]);

	const value = React.useMemo<OfflineContextValue>(
		() => ({
			online,
			pending,
			syncing,
			enqueue: enqueueWrite,
			flush,
			push: {
				supported: pushSupported,
				enabled: Boolean(pushConfig?.enabled),
				subscribed: pushSubscribed,
				busy: pushBusy,
				toggle: togglePush,
			},
		}),
		[
			online,
			pending,
			syncing,
			flush,
			pushSupported,
			pushConfig?.enabled,
			pushSubscribed,
			pushBusy,
			togglePush,
		],
	);

	return (
		<OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
	);
}
