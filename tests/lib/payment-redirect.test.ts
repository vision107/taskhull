import { describe, expect, it } from "vitest";

import { appConfig } from "@/config/app.config";
import { isAllowedPaymentRedirectUrl } from "@/lib/billing/redirect";

const applicationUrl = (path: string) =>
	new URL(path, appConfig.baseUrl).toString();

describe("payment redirect URLs", () => {
	it.each([
		applicationUrl(
			"/dashboard/billing/return?session_id={CHECKOUT_SESSION_ID}",
		),
		applicationUrl("/dashboard/organization/settings?tab=subscription"),
	])("accepts application URL %s", (url) => {
		expect(isAllowedPaymentRedirectUrl(url)).toBe(true);
	});

	it.each([
		"https://example.com/dashboard",
		"//example.com/dashboard",
		"javascript:alert(1)",
		"not-a-url",
		`${appConfig.baseUrl}.example.com/dashboard`,
	])("rejects unsafe payment redirect %s", (url) => {
		expect(isAllowedPaymentRedirectUrl(url)).toBe(false);
	});
});
