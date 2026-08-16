import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "@/lib/auth/constants";

describe("getAuthErrorMessage", () => {
	it("maps browser passkey cancellation errors", () => {
		expect(getAuthErrorMessage("ERROR_CEREMONY_ABORTED")).toBe(
			"Passkey request was cancelled.",
		);
	});

	it("maps duplicate passkey registration errors", () => {
		expect(
			getAuthErrorMessage("ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"),
		).toBe("This passkey is already registered.");
	});

	it("maps passkey user-verification errors", () => {
		for (const code of [
			"ERROR_AUTHENTICATOR_GENERAL_ERROR",
			"ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
			"PASSKEY_USER_VERIFICATION_REQUIRED",
		]) {
			expect(getAuthErrorMessage(code)).toBe(
				"Verify your identity with a PIN or biometric to use this passkey.",
			);
		}
	});
});
