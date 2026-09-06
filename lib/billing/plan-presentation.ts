import type { PlanDisplay, PriceDisplay } from "@/lib/billing/types";

const BILLING_LABEL_ACRONYMS: Record<string, string> = {
	ai: "AI",
	api: "API",
	saml: "SAML",
	sso: "SSO",
};

export function getPlanPrice(
	plan: PlanDisplay,
	interval: "month" | "year",
): PriceDisplay | undefined {
	return (
		plan.prices.find(
			(price) => price.type === "recurring" && price.interval === interval,
		) ?? plan.prices.find((price) => price.type === "one_time")
	);
}

export function getMonthlyEquivalent(price: PriceDisplay): number | null {
	if (price.type !== "recurring") return null;

	const intervalCount = price.intervalCount ?? 1;
	if (price.interval === "year") {
		return price.amount / (12 * intervalCount);
	}

	if (price.interval === "month") {
		return price.amount / intervalCount;
	}

	return null;
}

export function humanizeBillingKey(key: string): string {
	const withoutPrefix = key.replace(/^max/, "");
	const spaced = withoutPrefix
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim();

	return spaced
		.split(" ")
		.filter(Boolean)
		.map(
			(word) =>
				BILLING_LABEL_ACRONYMS[word.toLowerCase()] ??
				word[0]?.toUpperCase() + word.slice(1),
		)
		.join(" ");
}

export function getPlanLimitLabels(plan: PlanDisplay): string[] {
	if (!plan.limits) return [];

	return Object.entries(plan.limits).map(([key, value]) => {
		if (key === "maxMembers") {
			return value === -1 ? "Unlimited members" : `${value} team members`;
		}

		if (key === "maxStorage") {
			return value === -1 ? "Unlimited storage" : `${value} GB storage`;
		}

		const label = humanizeBillingKey(key);
		return value === -1
			? `Unlimited ${label.toLowerCase()}`
			: `${value} ${label}`;
	});
}

export function getEnabledEntitlementLabels(plan: PlanDisplay): string[] {
	return Object.entries(plan.entitlements)
		.filter(([, enabled]) => enabled)
		.map(([key]) => humanizeBillingKey(key));
}
