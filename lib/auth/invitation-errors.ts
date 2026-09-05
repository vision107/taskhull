type AuthErrorLike = {
	code?: unknown;
	message?: unknown;
	status?: unknown;
};

function asAuthError(error: unknown): AuthErrorLike | null {
	return error !== null && typeof error === "object"
		? (error as AuthErrorLike)
		: null;
}

function hasCode(error: unknown, code: string): boolean {
	return asAuthError(error)?.code === code;
}

function hasMessage(error: unknown, message: string): boolean {
	const errorMessage = asAuthError(error)?.message;
	return typeof errorMessage === "string" && errorMessage.includes(message);
}

export type InvitationPageErrorKind =
	| "invalid"
	| "wrong-recipient"
	| "verification-required"
	| "organization-unavailable"
	| "inviter-unavailable"
	| "unknown";

export function getInvitationPageErrorKind(
	error: unknown,
): InvitationPageErrorKind {
	if (hasCode(error, "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION")) {
		return "wrong-recipient";
	}

	if (
		hasCode(error, "EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION") ||
		hasCode(
			error,
			"EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION",
		)
	) {
		return "verification-required";
	}

	if (hasCode(error, "ORGANIZATION_NOT_FOUND")) {
		return "organization-unavailable";
	}

	if (hasCode(error, "INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION")) {
		return "inviter-unavailable";
	}

	if (
		hasCode(error, "INVITATION_NOT_FOUND") ||
		hasMessage(error, "Invitation not found")
	) {
		return "invalid";
	}

	return "unknown";
}

export function getInvitationActionErrorMessage(
	error: unknown,
	expiresAt: Date,
	now = new Date(),
): string {
	const kind = getInvitationPageErrorKind(error);

	if (kind === "invalid") {
		return expiresAt.getTime() <= now.getTime()
			? "This invitation has expired."
			: "This invitation was canceled or has already been used.";
	}

	if (kind === "wrong-recipient") {
		return "This invitation was sent to a different email address.";
	}

	if (kind === "verification-required") {
		return "Please verify your email address before responding to this invitation.";
	}

	if (kind === "organization-unavailable") {
		return "This organization is no longer available.";
	}

	if (kind === "inviter-unavailable") {
		return "The person who invited you is no longer a member of this organization.";
	}

	if (hasCode(error, "ORGANIZATION_MEMBERSHIP_LIMIT_REACHED")) {
		return "This organization has reached its member limit.";
	}

	if (hasCode(error, "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION")) {
		return "You are already a member of this organization.";
	}

	return "Something went wrong. Please try again.";
}

export function getInviteMemberErrorMessage(
	error: unknown,
	email: string,
): string {
	if (hasCode(error, "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION")) {
		return `${email} already has a pending invitation.`;
	}

	if (hasCode(error, "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION")) {
		return `${email} is already a member of this organization.`;
	}

	if (
		hasCode(error, "ORGANIZATION_MEMBERSHIP_LIMIT_REACHED") ||
		hasCode(error, "INVITATION_LIMIT_REACHED")
	) {
		return "This organization has reached its invitation or member limit.";
	}

	if (
		hasCode(
			error,
			"YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION",
		) ||
		hasCode(error, "YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE")
	) {
		return "You do not have permission to send this invitation.";
	}

	return "Something went wrong. Please try again.";
}
