import { describe, expect, it } from "vitest";

import {
	calculateExtendedTrialEnd,
	createExtendTrialParams,
	createGrantTrialParams,
	isCurrentSubscriptionStatus,
} from "@/lib/billing/admin-subscription-access-logic";

describe("admin subscription access logic", () => {
	it("treats only terminal Stripe subscriptions as replaceable", () => {
		expect(isCurrentSubscriptionStatus("active")).toBe(true);
		expect(isCurrentSubscriptionStatus("trialing")).toBe(true);
		expect(isCurrentSubscriptionStatus("past_due")).toBe(true);
		expect(isCurrentSubscriptionStatus("canceled")).toBe(false);
		expect(isCurrentSubscriptionStatus("incomplete_expired")).toBe(false);
	});

	it("creates a seat-aware trial that cancels without a payment method", () => {
		expect(
			createGrantTrialParams({
				organizationId: "273f89c1-5236-4ce7-9870-336855ac34ee",
				stripeCustomerId: "cus_test",
				stripePriceId: "price_pro",
				memberCount: 4,
				seatBased: true,
				trialDays: 21,
			}),
		).toEqual({
			customer: "cus_test",
			items: [{ price: "price_pro", quantity: 4 }],
			trial_period_days: 21,
			trial_settings: {
				end_behavior: { missing_payment_method: "cancel" },
			},
			metadata: {
				organizationId: "273f89c1-5236-4ce7-9870-336855ac34ee",
				accessGrantedByAdmin: "true",
			},
		});
	});

	it("uses at least one seat and omits quantity for flat pricing", () => {
		const seatBased = createGrantTrialParams({
			organizationId: "org",
			stripeCustomerId: "cus_test",
			stripePriceId: "price_pro",
			memberCount: 0,
			seatBased: true,
			trialDays: 14,
		});
		const flat = createGrantTrialParams({
			organizationId: "org",
			stripeCustomerId: "cus_test",
			stripePriceId: "price_pro",
			memberCount: 10,
			seatBased: false,
			trialDays: 14,
		});

		expect(seatBased.items?.[0]?.quantity).toBe(1);
		expect(flat.items?.[0]?.quantity).toBeUndefined();
	});

	it("extends from the later of now and the current trial end", () => {
		const now = new Date("2026-09-06T12:00:00.000Z");
		const futureTrialEnd = new Date("2026-09-10T12:00:00.000Z");
		const expiredTrialEnd = new Date("2026-09-01T12:00:00.000Z");

		expect(
			calculateExtendedTrialEnd({
				currentTrialEnd: futureTrialEnd,
				additionalDays: 7,
				now,
			}),
		).toEqual(new Date("2026-09-17T12:00:00.000Z"));
		expect(
			calculateExtendedTrialEnd({
				currentTrialEnd: expiredTrialEnd,
				additionalDays: 7,
				now,
			}),
		).toEqual(new Date("2026-09-13T12:00:00.000Z"));
	});

	it("disables proration when updating the trial end", () => {
		expect(
			createExtendTrialParams({
				currentTrialEnd: new Date("2026-09-10T12:00:00.000Z"),
				additionalDays: 7,
				now: new Date("2026-09-06T12:00:00.000Z"),
			}),
		).toEqual({
			trial_end: 1_789_646_400,
			proration_behavior: "none",
		});
	});
});
