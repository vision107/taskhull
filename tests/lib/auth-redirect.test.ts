import { describe, expect, it } from "vitest";

import {
	getAuthRedirectPath,
	getSafeRedirectPath,
	getValidInvitationId,
} from "@/lib/auth/redirect";

const invitationId = "10000000-0000-4000-8000-000000000001";

describe("getSafeRedirectPath", () => {
	it.each([
		["https://example.com/account", "/dashboard"],
		["//example.com/account", "/dashboard"],
		["javascript:alert(1)", "/dashboard"],
		["dashboard", "/dashboard"],
		["/%", "/dashboard"],
	])("rejects unsafe redirect %s", (redirectTo, expected) => {
		expect(getSafeRedirectPath(redirectTo, "/dashboard")).toBe(expected);
	});

	it.each([
		["/dashboard", "/dashboard"],
		["/dashboard/settings?tab=security", "/dashboard/settings?tab=security"],
		["/dashboard#billing", "/dashboard#billing"],
	])("accepts internal redirect %s", (redirectTo, expected) => {
		expect(getSafeRedirectPath(redirectTo)).toBe(expected);
	});

	it("uses a safe root fallback when both values are unsafe", () => {
		expect(getSafeRedirectPath("https://example.com", "//example.com")).toBe(
			"/",
		);
	});
});

describe("invitation redirects", () => {
	it("accepts UUID invitation identifiers", () => {
		expect(getValidInvitationId(invitationId)).toBe(invitationId);
		expect(
			getAuthRedirectPath({
				invitationId,
				redirectTo: "/dashboard/settings",
			}),
		).toBe(`/dashboard/organization-invitation/${invitationId}`);
	});

	it.each(["not-a-uuid", "../settings", "", null])(
		"rejects invalid invitation identifier %s",
		(value) => {
			expect(getValidInvitationId(value)).toBeNull();
			expect(
				getAuthRedirectPath({
					invitationId: value,
					redirectTo: "/dashboard/settings",
				}),
			).toBe("/dashboard/settings");
		},
	);
});
