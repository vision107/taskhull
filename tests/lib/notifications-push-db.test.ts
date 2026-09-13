import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db, pushSubscriptionTable, userTable } from "@/lib/db";

const USER_A = "c1111111-1111-4111-8111-111111111111";
const USER_B = "c2222222-2222-4222-8222-222222222222";

const sendNotification = vi.fn();

vi.mock("web-push", () => ({
	default: {
		setVapidDetails: vi.fn(),
		sendNotification: (...args: unknown[]) => sendNotification(...args),
	},
}));

// The shared DB setup already mocks `@/lib/env` (with a dynamic DATABASE_URL
// getter); only add the VAPID keys on top so push is "configured".
const { env } = await import("@/lib/env");
Object.assign(env, {
	NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
	VAPID_PRIVATE_KEY: "private-key",
	VAPID_SUBJECT: "mailto:test@example.com",
});

async function seed() {
	await db.delete(pushSubscriptionTable);
	await db
		.insert(userTable)
		.values(
			[
				{ id: USER_A, email: "push-a@example.com", name: "A" },
				{ id: USER_B, email: "push-b@example.com", name: "B" },
			].map((u) => ({
				...u,
				emailVerified: true,
				image: null,
				username: u.name.toLowerCase(),
				role: "user" as const,
				banned: false,
				banReason: null,
				banExpires: null,
				onboardingComplete: true,
			})),
		)
		.onConflictDoNothing();

	await db.insert(pushSubscriptionTable).values([
		{
			userId: USER_A,
			endpoint: "https://push.example/a-phone",
			p256dh: "p",
			auth: "a",
		},
		{
			userId: USER_A,
			endpoint: "https://push.example/a-old-phone",
			p256dh: "p",
			auth: "a",
		},
		{
			userId: USER_B,
			endpoint: "https://push.example/b-phone",
			p256dh: "p",
			auth: "a",
		},
	]);
}

describe("sendPushToUsers", () => {
	beforeEach(async () => {
		sendNotification.mockReset();
		await seed();
	});

	it("fans out to every device of the recipients and prunes dead subscriptions", async () => {
		const { sendPushToUsers } = await import("@/lib/notifications/push");

		sendNotification.mockImplementation(
			async (subscription: { endpoint: string }) => {
				if (subscription.endpoint.endsWith("a-old-phone")) {
					throw Object.assign(new Error("Gone"), { statusCode: 410 });
				}
				return { statusCode: 201 };
			},
		);

		const result = await sendPushToUsers([USER_A, USER_A], {
			title: "New task assigned",
			body: "Wire control cabinet · CX-1",
			url: "/dashboard/work/tasks/x",
		});

		expect(result).toEqual({ sent: 1, removed: 1 });
		expect(sendNotification).toHaveBeenCalledTimes(2);

		const payload = JSON.parse(
			sendNotification.mock.calls[0]![1] as string,
		) as Record<string, unknown>;
		expect(payload).toMatchObject({
			title: "New task assigned",
			url: "/dashboard/work/tasks/x",
		});

		const remaining = await db.query.pushSubscriptionTable.findMany({
			where: eq(pushSubscriptionTable.userId, USER_A),
		});
		expect(remaining.map((s) => s.endpoint)).toEqual([
			"https://push.example/a-phone",
		]);
		expect(remaining[0]!.lastUsedAt).not.toBeNull();

		// Other users untouched.
		const others = await db.query.pushSubscriptionTable.findMany({
			where: eq(pushSubscriptionTable.userId, USER_B),
		});
		expect(others).toHaveLength(1);
	});

	it("does nothing for users without devices", async () => {
		const { sendPushToUsers } = await import("@/lib/notifications/push");
		const result = await sendPushToUsers(
			["c3333333-3333-4333-8333-333333333333"],
			{ title: "x", body: "y" },
		);
		expect(result).toEqual({ sent: 0, removed: 0 });
		expect(sendNotification).not.toHaveBeenCalled();
	});
});
