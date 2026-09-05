import { describe, expect, it } from "vitest";

import { BillingEntitlement } from "@/config/billing.config";
import { getPlanEntitlements, planHasEntitlement } from "@/lib/billing/plans";

describe("billing entitlements", () => {
	it("keeps free-plan feature access explicit", () => {
		expect(getPlanEntitlements("free")).toEqual({
			advancedAnalytics: false,
			customIntegrations: false,
			apiAccess: false,
		});
	});

	it("grants configured paid-plan entitlements", () => {
		expect(
			planHasEntitlement("pro", BillingEntitlement.advancedAnalytics),
		).toBe(true);
		expect(planHasEntitlement("pro", BillingEntitlement.apiAccess)).toBe(true);
	});

	it("falls back to free-plan entitlements for unknown plans", () => {
		expect(
			planHasEntitlement("retired-plan", BillingEntitlement.apiAccess),
		).toBe(false);
	});
});
