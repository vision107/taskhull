import { describe, expect, it } from "vitest";

import {
	getEmailVerificationCallbackPath,
	getEmailVerificationError,
	getEmailVerificationErrorMessage,
} from "@/lib/auth/email-verification";

describe("email verification", () => {
	it("builds a callback that preserves only a safe internal destination", () => {
		expect(getEmailVerificationCallbackPath("/dashboard/settings")).toBe(
			"/auth/verify-email?status=verified&redirectTo=%2Fdashboard%2Fsettings",
		);
		expect(
			getEmailVerificationCallbackPath(
				"/dashboard/settings",
				" Person@Example.com ",
			),
		).toBe(
			"/auth/verify-email?status=verified&redirectTo=%2Fdashboard%2Fsettings&email=person@example.com",
		);
		expect(getEmailVerificationCallbackPath("https://attacker.example")).toBe(
			"/auth/verify-email?status=verified&redirectTo=%2Fdashboard",
		);
	});

	it("accepts only verification-link errors", () => {
		expect(getEmailVerificationError("TOKEN_EXPIRED")).toBe("TOKEN_EXPIRED");
		expect(getEmailVerificationError(["INVALID_TOKEN", "ignored"])).toBe(
			"INVALID_TOKEN",
		);
		expect(getEmailVerificationError("USER_NOT_FOUND")).toBe("USER_NOT_FOUND");
		expect(getEmailVerificationError("SOMETHING_ELSE")).toBeNull();
	});

	it("explains expired and invalid or reused links", () => {
		expect(getEmailVerificationErrorMessage("TOKEN_EXPIRED")).toContain(
			"expired",
		);
		expect(getEmailVerificationErrorMessage("INVALID_TOKEN")).toContain(
			"already been used",
		);
	});
});
