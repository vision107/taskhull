import { describe, expect, it } from "vitest";

import { isExpectedTrpcError } from "@/lib/sentry/expected-errors";

describe("isExpectedTrpcError", () => {
	it("filters the expected billing authorization rejection", () => {
		expect(
			isExpectedTrpcError({
				exception: {
					values: [
						{
							type: "TRPCError",
							value: "Only organization owners and admins can manage billing",
						},
					],
				},
			}),
		).toBe(true);
	});

	it("keeps unexpected tRPC failures reportable", () => {
		expect(
			isExpectedTrpcError({
				exception: {
					values: [{ type: "TRPCError", value: "Database unavailable" }],
				},
			}),
		).toBe(false);
	});
});
