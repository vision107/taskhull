import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import type { Context } from "@/trpc/context";
import {
	createCallerFactory,
	createTRPCRouter,
	publicProcedure,
} from "@/trpc/init";

const sentry = vi.hoisted(() => {
	const scopes: Array<{
		contexts: Record<string, unknown>;
		tags: Record<string, string>;
		user?: { email?: string; id?: string };
	}> = [];

	return {
		scopes,
		trpcMiddleware: vi.fn(
			() =>
				async ({ next }: { next: () => Promise<unknown> }) =>
					await next(),
		),
		withIsolationScope: vi.fn(
			async (
				callback: (scope: {
					setContext: (key: string, value: unknown) => void;
					setTag: (key: string, value: string) => void;
					setUser: (user: { email?: string; id?: string }) => void;
				}) => Promise<unknown>,
			) => {
				const record: (typeof scopes)[number] = { contexts: {}, tags: {} };
				scopes.push(record);

				return await callback({
					setContext: (key, value) => {
						record.contexts[key] = value;
					},
					setTag: (key, value) => {
						record.tags[key] = value;
					},
					setUser: (user) => {
						record.user = user;
					},
				});
			},
		),
	};
});

vi.mock("@sentry/nextjs", () => ({
	trpcMiddleware: sentry.trpcMiddleware,
	withIsolationScope: sentry.withIsolationScope,
}));

vi.mock("@/lib/logger", () => ({
	logger: {
		error: vi.fn(),
	},
}));

const testRouter = createTRPCRouter({
	read: publicProcedure
		.input(z.object({ organizationId: z.string().optional() }))
		.query(({ input }) => input),
});

const createCaller = createCallerFactory(testRouter);

describe("tRPC Sentry scope isolation", () => {
	it("does not carry user or organization tags into a later request", async () => {
		const authenticatedContext: Context & {
			activeOrganizationId: string;
			user: { email: string; id: string; role: string };
		} = {
			activeOrganizationId: "org-1",
			ip: null,
			requestId: "request-1",
			userAgent: null,
			user: {
				email: "first@example.com",
				id: "user-1",
				role: "member",
			},
		};

		await createCaller(authenticatedContext).read({ organizationId: "org-1" });
		await createCaller({
			ip: null,
			requestId: "request-2",
			userAgent: null,
		}).read({});

		expect(sentry.scopes).toHaveLength(2);
		expect(sentry.scopes[0]?.user).toEqual({
			email: "first@example.com",
			id: "user-1",
		});
		expect(sentry.scopes[0]?.tags.organizationId).toBe("org-1");
		expect(sentry.scopes[1]).not.toBe(sentry.scopes[0]);
		expect(sentry.scopes[1]?.user).toBeUndefined();
		expect(sentry.scopes[1]?.tags.organizationId).toBeUndefined();
		expect(sentry.withIsolationScope).toHaveBeenCalledTimes(2);
	});
});
