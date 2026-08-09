const INTERNAL_REDIRECT_ORIGIN = "https://app.invalid";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getSafeRedirectPath(
	redirectTo: string | null | undefined,
	fallback = "/dashboard",
): string {
	return (
		normalizeInternalPath(redirectTo) ?? normalizeInternalPath(fallback) ?? "/"
	);
}

export function getValidInvitationId(
	invitationId: string | null | undefined,
): string | null {
	return invitationId && UUID_PATTERN.test(invitationId) ? invitationId : null;
}

export function getAuthRedirectPath({
	invitationId,
	redirectTo,
	fallback,
}: {
	invitationId?: string | null;
	redirectTo?: string | null;
	fallback?: string;
}): string {
	const validInvitationId = getValidInvitationId(invitationId);

	return validInvitationId
		? `/dashboard/organization-invitation/${validInvitationId}`
		: getSafeRedirectPath(redirectTo, fallback);
}

function normalizeInternalPath(path: string | null | undefined): string | null {
	if (!path?.startsWith("/")) {
		return null;
	}

	try {
		decodeURI(path);
		const url = new URL(path, INTERNAL_REDIRECT_ORIGIN);
		const normalizedPath = `${url.pathname}${url.search}${url.hash}`;

		if (
			url.origin !== INTERNAL_REDIRECT_ORIGIN ||
			normalizedPath.startsWith("//")
		) {
			return null;
		}

		return normalizedPath;
	} catch {
		return null;
	}
}
