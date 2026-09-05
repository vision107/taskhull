import { describe, expect, it } from "vitest";

import {
	getTrpcErrorCode,
	isExpectedTrpcError,
	tagTrpcError,
} from "@/lib/sentry/expected-errors";

const trpcEvent = (value: string) => ({
	exception: {
		values: [{ type: "TRPCError", value }],
	},
});

describe("Sentry tRPC error filtering", () => {
	it("filters a curated billing authorization rejection", () => {
		expect(
			isExpectedTrpcError(
				trpcEvent("Only organization owners and admins can manage billing"),
			),
		).toBe(true);
	});

	it("filters a curated admin subscription validation outcome", () => {
		const event = trpcEvent("Only an active trial can be extended.");
		const hint = {
			originalException: {
				name: "TRPCError",
				code: "BAD_REQUEST",
			},
		};

		expect(isExpectedTrpcError(event, hint)).toBe(true);
	});

	it("filters not-found outcomes using the original tRPC code", () => {
		const event = trpcEvent("This pending invitation no longer exists.");
		const hint = {
			originalException: {
				name: "TRPCError",
				code: "NOT_FOUND",
			},
		};

		expect(getTrpcErrorCode(event, hint)).toBe("NOT_FOUND");
		expect(isExpectedTrpcError(event, hint)).toBe(true);
	});

	it("resolves codes from client errors and nested causes", () => {
		const event = trpcEvent("Request rejected");
		const hint = {
			originalException: {
				cause: {
					name: "TRPCClientError",
					data: { code: "CONFLICT" },
				},
			},
		};

		expect(getTrpcErrorCode(event, hint)).toBe("CONFLICT");
	});

	it("tags reportable client errors instead of dropping them", () => {
		const event: ReturnType<typeof trpcEvent> & {
			tags?: Record<string, unknown>;
		} = trpcEvent("User is already banned");
		const hint = {
			originalException: {
				name: "TRPCError",
				code: "BAD_REQUEST",
			},
		};

		tagTrpcError(event, hint);

		expect(event.tags).toEqual({
			trpcErrorCode: "BAD_REQUEST",
			trpcClientError: "true",
		});
		expect(isExpectedTrpcError(event, hint)).toBe(false);
	});

	it("keeps unexpected tRPC failures reportable", () => {
		const event = trpcEvent("Database unavailable");
		const hint = {
			originalException: {
				name: "TRPCError",
				code: "INTERNAL_SERVER_ERROR",
			},
		};

		expect(isExpectedTrpcError(event, hint)).toBe(false);
	});

	it("does not filter unrelated exceptions with matching text", () => {
		expect(
			isExpectedTrpcError({
				exception: {
					values: [{ type: "Error", value: "Forbidden" }],
				},
			}),
		).toBe(false);
	});
});
