export const BILLING_EVENT_PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type BillingEventClaimState = {
	processed: boolean;
	error: string | null;
	updatedAt: Date;
};

/**
 * Failed events and abandoned processing attempts may be claimed again.
 * Fresh in-flight events remain leased to the request currently handling them.
 */
export function canRetryBillingEvent(
	event: BillingEventClaimState,
	now = new Date(),
): boolean {
	if (event.processed) return false;
	if (event.error !== null) return true;

	return (
		event.updatedAt.getTime() <=
		now.getTime() - BILLING_EVENT_PROCESSING_LEASE_MS
	);
}
