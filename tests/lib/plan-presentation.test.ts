import { describe, expect, it } from "vitest";

import {
	getEnabledEntitlementLabels,
	getMonthlyEquivalent,
	getPlanLimitLabels,
	getPlanPrice,
	humanizeBillingKey,
} from "@/lib/billing/plan-presentation";
import type { PlanDisplay } from "@/lib/billing/types";

const plan: PlanDisplay = {
	id: "pro",
	name: "Pro",
	description: "For growing teams",
	features: [],
	entitlements: {
		advancedAnalytics: true,
		customIntegrations: false,
	},
	limits: { maxMembers: -1, maxStorage: 100 },
	prices: [
		{
			id: "monthly",
			stripePriceId: "price_monthly",
			type: "recurring",
			amount: 2900,
			currency: "usd",
			interval: "month",
			intervalCount: 1,
		},
		{
			id: "yearly",
			stripePriceId: "price_yearly",
			type: "recurring",
			amount: 27800,
			currency: "usd",
			interval: "year",
			intervalCount: 1,
		},
	],
};

describe("billing plan presentation", () => {
	it("selects a recurring price for the requested interval", () => {
		expect(getPlanPrice(plan, "year")?.id).toBe("yearly");
	});

	it("falls back to a one-time price when a plan is not recurring", () => {
		const lifetime = {
			...plan,
			prices: [
				{
					...plan.prices[0]!,
					id: "lifetime",
					type: "one_time" as const,
					interval: null,
				},
			],
		};

		expect(getPlanPrice(lifetime, "month")?.id).toBe("lifetime");
	});

	it("calculates monthly equivalents for monthly and annual prices", () => {
		expect(getMonthlyEquivalent(plan.prices[0]!)).toBe(2900);
		expect(getMonthlyEquivalent(plan.prices[1]!)).toBeCloseTo(2316.67, 2);
	});

	it("formats structured limits and enabled entitlements", () => {
		expect(getPlanLimitLabels(plan)).toEqual([
			"Unlimited members",
			"100 GB storage",
		]);
		expect(getEnabledEntitlementLabels(plan)).toEqual(["Advanced Analytics"]);
		expect(humanizeBillingKey("priority_support")).toBe("Priority Support");
		expect(humanizeBillingKey("apiAccess")).toBe("API Access");
		expect(humanizeBillingKey("ssoSaml")).toBe("SSO SAML");
	});
});
