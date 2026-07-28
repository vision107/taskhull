import { describe, expect, it } from "vitest";

import {
	getSubscriptionSnapshot,
	optimisticallyCancelSubscription,
	restoreSubscriptionSnapshot,
} from "@/lib/billing/optimistic-subscription";
import { SubscriptionStatus } from "@/lib/db/schema/enums";

const subscriptions = [
	{
		id: "organization-a",
		subscriptionId: "subscription-a",
		subscriptionStatus: SubscriptionStatus.active,
		cancelAtPeriodEnd: false,
	},
	{
		id: "organization-b",
		subscriptionId: "subscription-b",
		subscriptionStatus: SubscriptionStatus.active,
		cancelAtPeriodEnd: false,
	},
];

describe("optimistic subscription cancellation", () => {
	it("rolls back only the failed subscription when mutations overlap", () => {
		const failedSnapshot = getSubscriptionSnapshot(
			subscriptions,
			"subscription-a",
		);
		expect(failedSnapshot).not.toBeNull();

		const firstOptimisticState = optimisticallyCancelSubscription(
			subscriptions,
			"subscription-a",
			false,
		);
		const overlappingOptimisticState = optimisticallyCancelSubscription(
			firstOptimisticState,
			"subscription-b",
			false,
		);
		const rolledBackState = restoreSubscriptionSnapshot(
			overlappingOptimisticState,
			failedSnapshot!,
		);

		expect(rolledBackState).toEqual([
			subscriptions[0],
			{
				...subscriptions[1],
				cancelAtPeriodEnd: true,
			},
		]);
	});

	it("marks immediate cancellation without changing unrelated records", () => {
		expect(
			optimisticallyCancelSubscription(subscriptions, "subscription-a", true),
		).toEqual([
			{
				...subscriptions[0],
				subscriptionStatus: SubscriptionStatus.canceled,
			},
			subscriptions[1],
		]);
	});
});
