import { describe, expect, it } from "vitest";

import {
	getInvitationActionErrorMessage,
	getInvitationPageErrorKind,
	getInviteMemberErrorMessage,
} from "@/lib/auth/invitation-errors";

describe("invitation errors", () => {
	it("classifies errors used by the invitation page", () => {
		expect(getInvitationPageErrorKind({ code: "INVITATION_NOT_FOUND" })).toBe(
			"invalid",
		);
		expect(
			getInvitationPageErrorKind({
				code: "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION",
			}),
		).toBe("wrong-recipient");
		expect(
			getInvitationPageErrorKind({
				code: "EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION",
			}),
		).toBe("verification-required");
	});

	it("distinguishes expired invitations from canceled or used invitations", () => {
		const error = { code: "INVITATION_NOT_FOUND" };
		const now = new Date("2026-09-05T12:00:00.000Z");

		expect(
			getInvitationActionErrorMessage(
				error,
				new Date("2026-09-05T11:59:00.000Z"),
				now,
			),
		).toBe("This invitation has expired.");
		expect(
			getInvitationActionErrorMessage(
				error,
				new Date("2026-09-05T12:01:00.000Z"),
				now,
			),
		).toBe("This invitation was canceled or has already been used.");
	});

	it("gives actionable invite-member errors without leaking unknown details", () => {
		expect(
			getInviteMemberErrorMessage(
				{ code: "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION" },
				"person@example.com",
			),
		).toBe("person@example.com is already a member of this organization.");
		expect(
			getInviteMemberErrorMessage(
				new Error("private provider detail"),
				"person@example.com",
			),
		).toBe("Something went wrong. Please try again.");
	});
});
