import { describe, expect, it } from "vitest";

import {
	claimBillingEvent,
	markBillingEventError,
	markBillingEventProcessed,
} from "@/lib/billing";
import { BILLING_EVENT_PROCESSING_LEASE_MS } from "@/lib/billing/event-claim";

const event = (stripeEventId: string) => ({
	stripeEventId,
	eventType: "checkout.session.completed",
	eventData: JSON.stringify({ status: "processing" }),
});

describe("billing event database claims", () => {
	it("reclaims failed events and stops after success", async () => {
		const now = new Date("2026-08-15T12:00:00.000Z");
		const first = await claimBillingEvent(event("evt_retry"), now);

		expect(first.status).toBe("claimed");
		expect(await claimBillingEvent(event("evt_retry"), now)).toEqual({
			status: "already_processing",
		});

		if (first.status !== "claimed") throw new Error("Expected event claim");
		await markBillingEventError(first.eventId, "connection reset", true);

		const retry = await claimBillingEvent(event("evt_retry"), now);
		expect(retry.status).toBe("claimed");

		if (retry.status !== "claimed") throw new Error("Expected retry claim");
		await markBillingEventProcessed(retry.eventId);

		expect(await claimBillingEvent(event("evt_retry"), now)).toEqual({
			status: "already_processed",
		});
	});

	it("reclaims an abandoned processing lease", async () => {
		const startedAt = new Date("2026-08-15T12:00:00.000Z");
		await claimBillingEvent(event("evt_abandoned"), startedAt);

		const afterLease = new Date(
			startedAt.getTime() + BILLING_EVENT_PROCESSING_LEASE_MS,
		);
		expect(
			(await claimBillingEvent(event("evt_abandoned"), afterLease)).status,
		).toBe("claimed");
	});

	it("does not reclaim terminal failures", async () => {
		const claim = await claimBillingEvent(event("evt_terminal"));
		if (claim.status !== "claimed") throw new Error("Expected event claim");

		await markBillingEventError(claim.eventId, "invalid payload", false);
		expect(await claimBillingEvent(event("evt_terminal"))).toEqual({
			status: "already_processed",
		});
	});
});
