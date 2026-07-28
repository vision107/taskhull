import { APIError } from "better-auth/api";

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

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

	if (
		!invitationId ||
		!UUID_PATTERN.test(invitationId) ||
		typeof email !== "string"
	) {
		throwInvalidInvitation();
	}

	const invitation = await findInvitation(invitationId);
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
