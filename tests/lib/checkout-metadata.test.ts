import { describe, expect, it } from "vitest";

import { buildCheckoutMetadata } from "@/lib/billing/checkout-metadata";

describe("checkout metadata", () => {
	it("prevents callers from overriding webhook routing fields", () => {
		expect(
			buildCheckoutMetadata({
				organizationId: "org_authoritative",
				planId: "plan_authoritative",
				priceId: "price_authoritative",
				metadata: {
					organizationId: "org_untrusted",
					planId: "plan_untrusted",
					priceId: "price_untrusted",
					userId: "user_123",
				},
			}),
		).toEqual({
			organizationId: "org_authoritative",
			planId: "plan_authoritative",
			priceId: "price_authoritative",
			userId: "user_123",
		});
	});
});
