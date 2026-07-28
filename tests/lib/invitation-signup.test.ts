import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";

import { assertInvitationSignUpAllowed } from "@/lib/auth/invitation-signup";

const invitationId = "10000000-0000-4000-8000-000000000001";
const now = new Date("2026-07-28T12:00:00.000Z");

async function expectInvalidInvitation(promise: Promise<void>): Promise<void> {
	await expect(promise).rejects.toMatchObject({
		status: "FORBIDDEN",
		body: {
			code: "INVALID_INVITATION",
		},
	} satisfies Partial<APIError>);
}

describe("assertInvitationSignUpAllowed", () => {
	it("allows public signup without loading an invitation", async () => {
		const findInvitation = vi.fn();

		await expect(
			assertInvitationSignUpAllowed({
				publicSignupEnabled: true,
				invitationId: null,
				email: "person@example.com",
				findInvitation,
				now,
			}),
		).resolves.toBeUndefined();
		expect(findInvitation).not.toHaveBeenCalled();
	});

	it("rejects signup without an invitation", async () => {
		await expectInvalidInvitation(
			assertInvitationSignUpAllowed({
				publicSignupEnabled: false,
				invitationId: null,
				email: "person@example.com",
				findInvitation: vi.fn(),
				now,
			}),
		);
	});

	it("rejects an invalid invitation id before querying the database", async () => {
		const findInvitation = vi.fn();

		await expectInvalidInvitation(
			assertInvitationSignUpAllowed({
				publicSignupEnabled: false,
				invitationId: "not-a-uuid",
				email: "person@example.com",
				findInvitation,
				now,
			}),
		);
		expect(findInvitation).not.toHaveBeenCalled();
	});

	it.each([
		["missing", null],
		[
			"expired",
			{
				email: "person@example.com",
				status: "pending",
				expiresAt: new Date("2026-07-28T11:59:59.000Z"),
			},
		],
		[
			"revoked",
			{
				email: "person@example.com",
				status: "rejected",
				expiresAt: new Date("2026-07-29T12:00:00.000Z"),
			},
		],
		[
			"email-mismatched",
			{
				email: "invited@example.com",
				status: "pending",
				expiresAt: new Date("2026-07-29T12:00:00.000Z"),
			},
		],
	])("rejects a %s invitation", async (_caseName, invitation) => {
		await expectInvalidInvitation(
			assertInvitationSignUpAllowed({
				publicSignupEnabled: false,
				invitationId,
				email: "person@example.com",
				findInvitation: vi.fn().mockResolvedValue(invitation),
				now,
			}),
		);
	});

	it("allows a pending invitation for the submitted email", async () => {
		await expect(
			assertInvitationSignUpAllowed({
				publicSignupEnabled: false,
				invitationId,
				email: " Invited@Example.com ",
				findInvitation: vi.fn().mockResolvedValue({
					email: "invited@example.com",
					status: "pending",
					expiresAt: new Date("2026-07-29T12:00:00.000Z"),
				}),
				now,
			}),
		).resolves.toBeUndefined();
	});
});
