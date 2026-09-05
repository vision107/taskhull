import { describe, expect, it } from "vitest";

import { getAdminSubscriptionActions } from "@/lib/billing/admin-subscription-actions";

describe("admin subscription action availability", () => {
	it("offers a grant when no subscription exists", () => {
		expect(
			getAdminSubscriptionActions({
				subscriptionId: null,
				status: null,
				cancelAtPeriodEnd: null,
			}),
		).toEqual({
			canGrantAccess: true,
			canExtendTrial: false,
			canReactivate: false,
		});
	});

	it.each(["canceled", "incomplete_expired"])(
		"offers a replacement grant for a terminal %s subscription",
		(status) => {
			expect(
				getAdminSubscriptionActions({
					subscriptionId: "sub_123",
					status,
					cancelAtPeriodEnd: false,
				}).canGrantAccess,
			).toBe(true);
		},
	);

	it("offers trial extension only for a current trial", () => {
		expect(
			getAdminSubscriptionActions({
				subscriptionId: "sub_123",
				status: "trialing",
				cancelAtPeriodEnd: false,
			}),
		).toEqual({
			canGrantAccess: false,
			canExtendTrial: true,
			canReactivate: false,
		});
	});

	it("offers reactivation for access scheduled to cancel", () => {
		expect(
			getAdminSubscriptionActions({
				subscriptionId: "sub_123",
				status: "active",
				cancelAtPeriodEnd: true,
			}),
		).toEqual({
			canGrantAccess: false,
			canExtendTrial: false,
			canReactivate: true,
		});
	});

	it("does not offer an invalid action for an ordinary active subscription", () => {
		expect(
			getAdminSubscriptionActions({
				subscriptionId: "sub_123",
				status: "active",
				cancelAtPeriodEnd: false,
			}),
		).toEqual({
			canGrantAccess: false,
			canExtendTrial: false,
			canReactivate: false,
		});
	});
});
