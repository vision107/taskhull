import { SubscriptionStatus } from "@/lib/db/schema/enums";

export type SubscriptionCacheRecord = {
	subscriptionId: string | null;
	subscriptionStatus: string | null;
	cancelAtPeriodEnd: boolean | null;
};

export type SubscriptionSnapshot = SubscriptionCacheRecord;

export function getSubscriptionSnapshot<T extends SubscriptionCacheRecord>(
	records: T[],
	subscriptionId: string,
): SubscriptionSnapshot | null {
	const record = records.find(
		(candidate) => candidate.subscriptionId === subscriptionId,
	);

	return record
		? {
				subscriptionId: record.subscriptionId,
				subscriptionStatus: record.subscriptionStatus,
				cancelAtPeriodEnd: record.cancelAtPeriodEnd,
			}
		: null;
}

export function optimisticallyCancelSubscription<
	T extends SubscriptionCacheRecord,
>(records: T[], subscriptionId: string, immediate: boolean): T[] {
	return records.map((record) =>
		record.subscriptionId === subscriptionId
			? {
					...record,
					subscriptionStatus: immediate
						? SubscriptionStatus.canceled
						: record.subscriptionStatus,
					cancelAtPeriodEnd: immediate ? record.cancelAtPeriodEnd : true,
				}
			: record,
	);
}

export function restoreSubscriptionSnapshot<T extends SubscriptionCacheRecord>(
	records: T[],
	snapshot: SubscriptionSnapshot,
): T[] {
	return records.map((record) =>
		record.subscriptionId === snapshot.subscriptionId
			? {
					...record,
					subscriptionStatus: snapshot.subscriptionStatus,
					cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
				}
			: record,
	);
}
