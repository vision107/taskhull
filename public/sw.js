/* eslint-disable */
/**
 * Taskhull worker PWA service worker.
 *
 * - Static Next.js assets: cache-first (they are content-hashed).
 * - Worker pages and tRPC queries: network-first, falling back to the last
 *   good response so the task list and task pages still open offline.
 * - Push: shows a notification and opens the linked page on tap.
 *
 * Writes done while offline are handled by the app (see lib/offline/queue.ts),
 * not by the service worker, so they stay under React Query's control.
 */

const VERSION = "v1";
const STATIC_CACHE = `taskhull-static-${VERSION}`;
const PAGES_CACHE = `taskhull-pages-${VERSION}`;
const DATA_CACHE = `taskhull-data-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const IS_DEV =
	self.location.hostname === "localhost" ||
	self.location.hostname === "127.0.0.1" ||
	self.location.hostname.endsWith(".trycloudflare.com") ||
	/^(192\.168|10)\./.test(self.location.hostname);

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(PAGES_CACHE)
			.then((cache) => cache.add(OFFLINE_URL))
			.catch(() => undefined)
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter(
							(key) =>
								key.startsWith("taskhull-") &&
								![STATIC_CACHE, PAGES_CACHE, DATA_CACHE].includes(key),
						)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

function isWorkerPage(url) {
	return (
		url.pathname === "/dashboard/work" ||
		url.pathname.startsWith("/dashboard/work/")
	);
}

async function networkFirst(request, cacheName, fallbackUrl) {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response && response.ok) {
			cache.put(request, response.clone()).catch(() => undefined);
		}
		return response;
	} catch (error) {
		const cached = await cache.match(request, { ignoreVary: true });
		if (cached) return cached;
		if (fallbackUrl) {
			const fallback = await caches.match(fallbackUrl);
			if (fallback) return fallback;
		}
		throw error;
	}
}

async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response && response.ok) {
		cache.put(request, response.clone()).catch(() => undefined);
	}
	return response;
}

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// Hashed build assets are safe to cache forever. In `next dev` they are not
	// hashed, so fall through to the network there to avoid stale modules.
	if (url.pathname.startsWith("/_next/static/")) {
		if (!IS_DEV) event.respondWith(cacheFirst(request, STATIC_CACHE));
		return;
	}

	if (request.mode === "navigate" && isWorkerPage(url)) {
		event.respondWith(networkFirst(request, PAGES_CACHE, OFFLINE_URL));
		return;
	}

	// tRPC queries are GET; keep the last good answer for offline reads.
	if (url.pathname.startsWith("/api/trpc/")) {
		event.respondWith(networkFirst(request, DATA_CACHE));
		return;
	}

	// RSC payloads for worker pages (client-side navigation).
	if (isWorkerPage(url) && request.headers.get("RSC") === "1") {
		event.respondWith(networkFirst(request, PAGES_CACHE));
	}
});

// ---------------------------------------------------------------------------
// Web push
// ---------------------------------------------------------------------------

self.addEventListener("push", (event) => {
	let payload = { title: "Taskhull", body: "", url: "/dashboard/work" };
	try {
		if (event.data) payload = { ...payload, ...event.data.json() };
	} catch {
		if (event.data) payload.body = event.data.text();
	}

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			icon: "/web-app-manifest-192x192.png",
			badge: "/web-app-manifest-192x192.png",
			tag: payload.tag || undefined,
			data: { url: payload.url || "/dashboard/work" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const target = new URL(
		(event.notification.data && event.notification.data.url) ||
			"/dashboard/work",
		self.location.origin,
	).href;

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clients) => {
				for (const client of clients) {
					if ("focus" in client) {
						client.focus();
						if ("navigate" in client) return client.navigate(target);
						return;
					}
				}
				return self.clients.openWindow(target);
			}),
	);
});
