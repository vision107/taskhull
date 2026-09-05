import { describe, expect, it } from "vitest";

import { assertAdminCanResetTwoFactor } from "@/lib/auth/admin-two-factor";

const targetUser = {
	id: "00000000-0000-4000-8000-000000000002",
	role: "user",
	twoFactorEnabled: true,
};

describe("assertAdminCanResetTwoFactor", () => {
	it("allows an admin to recover a non-admin account with 2FA enabled", () => {
		expect(() =>
			assertAdminCanResetTwoFactor({
				actorUserId: "00000000-0000-4000-8000-000000000001",
				isImpersonating: false,
				targetUser,
			}),
		).not.toThrow();
	});

	it("blocks recovery while impersonating", () => {
		expect(() =>
			assertAdminCanResetTwoFactor({
				actorUserId: "00000000-0000-4000-8000-000000000001",
				isImpersonating: true,
				targetUser,
			}),
		).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it("blocks recovery for administrator accounts", () => {
		expect(() =>
			assertAdminCanResetTwoFactor({
				actorUserId: "00000000-0000-4000-8000-000000000001",
				isImpersonating: false,
				targetUser: { ...targetUser, role: "admin" },
			}),
		).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it("rejects accounts that do not have 2FA enabled", () => {
		expect(() =>
			assertAdminCanResetTwoFactor({
				actorUserId: "00000000-0000-4000-8000-000000000001",
				isImpersonating: false,
				targetUser: { ...targetUser, twoFactorEnabled: false },
			}),
		).toThrowError(expect.objectContaining({ code: "BAD_REQUEST" }));
	});
});
