import { describe, expect, it } from "vitest";

import {
	BILLING_EVENT_PROCESSING_LEASE_MS,
	canRetryBillingEvent,
} from "@/lib/billing/event-claim";

const now = new Date("2026-08-15T12:00:00.000Z");

describe("billing event claims", () => {
	it("retries failed events immediately", () => {
		expect(
			canRetryBillingEvent(
				{ processed: false, error: "connection reset", updatedAt: now },
				now,
			),
		).toBe(true);
	});

	it("does not take over a fresh processing lease", () => {
		expect(
			canRetryBillingEvent(
				{ processed: false, error: null, updatedAt: now },
				now,
			),
		).toBe(false);
	});

	it("retries abandoned processing after the lease expires", () => {
		const updatedAt = new Date(
			now.getTime() - BILLING_EVENT_PROCESSING_LEASE_MS,
		);

		expect(
			canRetryBillingEvent({ processed: false, error: null, updatedAt }, now),
		).toBe(true);
	});

	it("never retries a completed or terminal event", () => {
		expect(
			canRetryBillingEvent(
				{ processed: true, error: "permanent failure", updatedAt: now },
				now,
			),
		).toBe(false);
	});
});
