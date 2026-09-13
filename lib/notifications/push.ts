import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";

import { db } from "@/lib/db/client";
import { pushSubscriptionTable } from "@/lib/db/schema/tables";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface PushPayload {
	title: string;
	body: string;
	url?: string | null;
	tag?: string;
}

/**
 * Web push is optional: without VAPID keys nothing is sent and the UI hides
 * the opt-in button.
 */
export function isPushConfigured(): boolean {
	return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function ensureVapid(): boolean {
	if (!isPushConfigured()) return false;
	if (!vapidReady) {
		webpush.setVapidDetails(
			env.VAPID_SUBJECT || "mailto:admin@example.com",
			env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
			env.VAPID_PRIVATE_KEY!,
		);
		vapidReady = true;
	}
	return true;
}

/**
 * Send one payload to every registered device of the given users. Expired or
 * revoked subscriptions (404/410) are deleted. Failures never propagate.
 */
export async function sendPushToUsers(
	userIds: string[],
	payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
	const unique = Array.from(new Set(userIds));
	if (unique.length === 0 || !ensureVapid()) return { sent: 0, removed: 0 };

	const subscriptions = await db.query.pushSubscriptionTable.findMany({
		where: inArray(pushSubscriptionTable.userId, unique),
	});
	if (subscriptions.length === 0) return { sent: 0, removed: 0 };

	const body = JSON.stringify(payload);
	let sent = 0;
	const stale: string[] = [];

	await Promise.all(
		subscriptions.map(async (subscription) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: subscription.endpoint,
						keys: { p256dh: subscription.p256dh, auth: subscription.auth },
					},
					body,
					{ TTL: 60 * 60 * 24, urgency: "normal" },
				);
				sent++;
			} catch (error) {
				const statusCode =
					typeof error === "object" && error && "statusCode" in error
						? (error as { statusCode?: number }).statusCode
						: undefined;
				if (statusCode === 404 || statusCode === 410) {
					stale.push(subscription.id);
				} else {
					logger.warn(
						{ error, endpoint: subscription.endpoint },
						"Web push delivery failed",
					);
				}
			}
		}),
	);

	if (stale.length > 0) {
		await db
			.delete(pushSubscriptionTable)
			.where(inArray(pushSubscriptionTable.id, stale));
	}
	if (sent > 0) {
		await db
			.update(pushSubscriptionTable)
			.set({ lastUsedAt: new Date() })
			.where(
				inArray(
					pushSubscriptionTable.id,
					subscriptions.filter((s) => !stale.includes(s.id)).map((s) => s.id),
				),
			);
	}

	return { sent, removed: stale.length };
}

export async function removePushSubscription(
	userId: string,
	endpoint: string,
): Promise<void> {
	await db
		.delete(pushSubscriptionTable)
		.where(eq(pushSubscriptionTable.endpoint, endpoint));
	logger.debug({ userId }, "Removed push subscription");
}
