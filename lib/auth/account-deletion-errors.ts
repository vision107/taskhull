export const ACCOUNT_DELETION_BLOCKED_CODE =
	"ACCOUNT_DELETION_BLOCKED_BY_OWNED_ORGANIZATION";

export const ACCOUNT_DELETION_BLOCKED_MESSAGE =
	"Transfer ownership or delete every organization you solely own before deleting your account.";

export function isAccountDeletionBlockedError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;

	const code = "code" in error ? String(error.code) : "";
	const message = "message" in error ? String(error.message) : "";

	return (
		code === ACCOUNT_DELETION_BLOCKED_CODE ||
		message === ACCOUNT_DELETION_BLOCKED_MESSAGE
	);
}
