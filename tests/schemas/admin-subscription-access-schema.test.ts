import { describe, expect, it } from "vitest";

import {
	extendSubscriptionAccessAdminSchema,
	grantSubscriptionAccessAdminSchema,
	reactivateSubscriptionAccessAdminSchema,
} from "@/schemas/admin-organization-schemas";

const organizationId = "273f89c1-5236-4ce7-9870-336855ac34ee";
const requestId = "f85c65bc-42ac-442f-8e7e-01066116b62a";

describe("admin subscription access schemas", () => {
	it("accepts bounded grant and extension requests", () => {
		expect(
			grantSubscriptionAccessAdminSchema.safeParse({
				organizationId,
				requestId,
				stripePriceId: "price_pro",
				trialDays: 365,
			}).success,
		).toBe(true);
		expect(
			extendSubscriptionAccessAdminSchema.safeParse({
				organizationId,
				requestId,
				subscriptionId: "sub_trial",
				additionalDays: 1,
			}).success,
		).toBe(true);
	});

	it("rejects excessive duration and malformed provider IDs", () => {
		expect(
			grantSubscriptionAccessAdminSchema.safeParse({
				organizationId,
				requestId,
				stripePriceId: "pro",
				trialDays: 366,
			}).success,
		).toBe(false);
		expect(
			reactivateSubscriptionAccessAdminSchema.safeParse({
				organizationId,
				requestId,
				subscriptionId: "invalid",
			}).success,
		).toBe(false);
	});
});
