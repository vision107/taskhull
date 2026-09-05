import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";

import {
	assertAccountDeletionAllowedForUser,
	type FindSoleOwnedOrganizations,
} from "@/lib/auth/account-deletion";
import {
	ACCOUNT_DELETION_BLOCKED_CODE,
	ACCOUNT_DELETION_BLOCKED_MESSAGE,
	isAccountDeletionBlockedError,
} from "@/lib/auth/account-deletion-errors";

const userId = "10000000-0000-4000-8000-000000000001";

describe("account deletion ownership guard", () => {
	it("allows deletion when the user does not solely own an organization", async () => {
		const findOrganizations: FindSoleOwnedOrganizations = vi
			.fn()
			.mockResolvedValue([]);

		await expect(
			assertAccountDeletionAllowedForUser(userId, findOrganizations),
		).resolves.toBeUndefined();
		expect(findOrganizations).toHaveBeenCalledWith(userId);
	});

	it("blocks deletion when the user is an organization's sole owner", async () => {
		const findOrganizations: FindSoleOwnedOrganizations = vi
			.fn()
			.mockResolvedValue([{ id: "organization-1", name: "Acme" }]);

		await expect(
			assertAccountDeletionAllowedForUser(userId, findOrganizations),
		).rejects.toMatchObject({
			status: "FORBIDDEN",
			body: {
				code: ACCOUNT_DELETION_BLOCKED_CODE,
				message: ACCOUNT_DELETION_BLOCKED_MESSAGE,
			},
		} satisfies Partial<APIError>);
	});

	it("recognizes only the dedicated client error code", () => {
		expect(
			isAccountDeletionBlockedError({
				code: ACCOUNT_DELETION_BLOCKED_CODE,
			}),
		).toBe(true);
		expect(isAccountDeletionBlockedError({ code: "OTHER_ERROR" })).toBe(false);
		expect(
			isAccountDeletionBlockedError({
				message: ACCOUNT_DELETION_BLOCKED_MESSAGE,
			}),
		).toBe(true);
		expect(isAccountDeletionBlockedError(null)).toBe(false);
	});
});
