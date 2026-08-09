import { APIError } from "better-auth/api";

import { getValidInvitationId } from "@/lib/auth/redirect";

export type SignUpInvitation = {
	email: string;
	status: string;
	expiresAt: Date;
};

export type AssertInvitationSignUpAllowedOptions = {
	publicSignupEnabled: boolean;
	invitationId: string | null;
	email: string | undefined;
	findInvitation: (id: string) => Promise<SignUpInvitation | null>;
	now?: Date;
};

function throwInvalidInvitation(): never {
	throw new APIError("FORBIDDEN", {
		code: "INVALID_INVITATION",
		message: "The invitation is invalid or expired.",
	});
}

export async function assertInvitationSignUpAllowed({
	publicSignupEnabled,
	invitationId,
	email,
	findInvitation,
	now = new Date(),
}: AssertInvitationSignUpAllowedOptions): Promise<void> {
	if (publicSignupEnabled) {
		return;
	}

	const validInvitationId = getValidInvitationId(invitationId);

	if (!validInvitationId || typeof email !== "string") {
		throwInvalidInvitation();
	}

	const invitation = await findInvitation(validInvitationId);
	const normalizedEmail = email.trim().toLowerCase();

	if (
		!invitation ||
		invitation.status !== "pending" ||
		invitation.expiresAt.getTime() <= now.getTime() ||
		invitation.email.trim().toLowerCase() !== normalizedEmail
	) {
		throwInvalidInvitation();
	}
}
