export type AdminSubscriptionActions = {
	canGrantAccess: boolean;
	canExtendTrial: boolean;
	canReactivate: boolean;
};

const TERMINAL_SUBSCRIPTION_STATUSES = new Set([
	"canceled",
	"incomplete_expired",
]);

export function getAdminSubscriptionActions(params: {
	subscriptionId: string | null;
	status: string | null;
	cancelAtPeriodEnd: boolean | null;
}): AdminSubscriptionActions {
	const hasSubscription = Boolean(params.subscriptionId);

	return {
		canGrantAccess:
			!hasSubscription ||
			Boolean(
				params.status && TERMINAL_SUBSCRIPTION_STATUSES.has(params.status),
			),
		canExtendTrial: hasSubscription && params.status === "trialing",
		canReactivate:
			hasSubscription &&
			params.cancelAtPeriodEnd === true &&
			params.status !== "canceled",
	};
}
