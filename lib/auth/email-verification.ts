import { withQuery } from "ufo";

import { getSafeRedirectPath } from "@/lib/auth/redirect";

export const EMAIL_VERIFICATION_PATH = "/auth/verify-email";

export type EmailVerificationError =
	| "INVALID_TOKEN"
	| "TOKEN_EXPIRED"
	| "USER_NOT_FOUND";

export function getEmailVerificationCallbackPath(
	redirectTo: string | null | undefined,
): string {
	return withQuery(EMAIL_VERIFICATION_PATH, {
		status: "verified",
		redirectTo: getSafeRedirectPath(redirectTo),
	});
}

export function getEmailVerificationError(
	error: string | string[] | null | undefined,
): EmailVerificationError | null {
	const code = Array.isArray(error) ? error[0] : error;

	return code === "INVALID_TOKEN" ||
		code === "TOKEN_EXPIRED" ||
		code === "USER_NOT_FOUND"
		? code
		: null;
}

export function getEmailVerificationErrorMessage(
	error: EmailVerificationError,
): string {
	if (error === "TOKEN_EXPIRED") {
		return "This verification link has expired. Request a new one below.";
	}

	if (error === "USER_NOT_FOUND") {
		return "We could not find an account for this verification link.";
	}

	return "This verification link is invalid or has already been used. Request a new one below.";
}
