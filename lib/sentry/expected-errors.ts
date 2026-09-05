type SentryExceptionLike = {
	type?: string;
	value?: string;
};

type SentryEventLike = {
	exception?: {
		values?: SentryExceptionLike[];
	};
	tags?: Record<string, unknown>;
};

type SentryHintLike = {
	originalException?: unknown;
};

type TrpcErrorCode =
	| "BAD_REQUEST"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "METHOD_NOT_SUPPORTED"
	| "TIMEOUT"
	| "CONFLICT"
	| "PRECONDITION_FAILED"
	| "PAYLOAD_TOO_LARGE"
	| "UNPROCESSABLE_CONTENT"
	| "TOO_MANY_REQUESTS"
	| "CLIENT_CLOSED_REQUEST"
	| "INTERNAL_SERVER_ERROR";

const TRPC_ERROR_CODES = new Set<TrpcErrorCode>([
	"BAD_REQUEST",
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"METHOD_NOT_SUPPORTED",
	"TIMEOUT",
	"CONFLICT",
	"PRECONDITION_FAILED",
	"PAYLOAD_TOO_LARGE",
	"UNPROCESSABLE_CONTENT",
	"TOO_MANY_REQUESTS",
	"CLIENT_CLOSED_REQUEST",
	"INTERNAL_SERVER_ERROR",
]);

const ALWAYS_EXPECTED_CODES = new Set<TrpcErrorCode>([
	"UNAUTHORIZED",
	"NOT_FOUND",
]);

type ExpectedErrorSignature = {
	code?: TrpcErrorCode;
	exact?: string;
	startsWith?: string;
};

/**
 * Expected domain and authorization outcomes that are already handled by the
 * interface. Keep this list deliberately narrow so programming and provider
 * failures remain visible in Sentry.
 */
const EXPECTED_ERROR_SIGNATURES: ExpectedErrorSignature[] = [
	{ code: "FORBIDDEN", exact: "Forbidden" },
	{
		code: "BAD_REQUEST",
		exact: "No active organization. Please select an organization first.",
	},
	{ code: "FORBIDDEN", exact: "Not a member of the organization" },
	{
		code: "FORBIDDEN",
		exact: "Only organization owners and admins can manage billing",
	},
	{
		code: "FORBIDDEN",
		exact: "Only organization owners and admins can cancel subscriptions",
	},
	{
		code: "FORBIDDEN",
		exact: "Only organization owners and admins can reactivate subscriptions",
	},
	{
		code: "FORBIDDEN",
		exact: "Only organization admins can purchase credits",
	},
	{
		code: "FORBIDDEN",
		exact: "You do not have permission to revoke invitations.",
	},
	{
		code: "FORBIDDEN",
		startsWith: "This feature requires a paid subscription.",
	},
	{
		code: "FORBIDDEN",
		startsWith: "This feature requires one of the following plans:",
	},
	{
		code: "FORBIDDEN",
		startsWith: 'This feature requires the "',
	},
	{
		code: "FORBIDDEN",
		exact:
			"You have reached the maximum number of team members for your plan. Please upgrade to add more members.",
	},
	{ code: "BAD_REQUEST", exact: "Stripe billing is not configured." },
	{
		code: "BAD_REQUEST",
		exact: "This organization already has active billing access.",
	},
	{
		code: "BAD_REQUEST",
		exact: "Select a configured recurring subscription price.",
	},
	{
		code: "BAD_REQUEST",
		exact: "This organization already has a current Stripe subscription.",
	},
	{ code: "BAD_REQUEST", exact: "Only an active trial can be extended." },
	{
		code: "BAD_REQUEST",
		exact:
			"Only a current subscription scheduled for cancellation can be reactivated.",
	},
	{
		code: "BAD_REQUEST",
		exact: "The subscription does not belong to this organization.",
	},
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function asTrpcErrorCode(value: unknown): TrpcErrorCode | undefined {
	return typeof value === "string" &&
		TRPC_ERROR_CODES.has(value as TrpcErrorCode)
		? (value as TrpcErrorCode)
		: undefined;
}

function getCodeFromException(
	error: unknown,
	depth = 0,
): TrpcErrorCode | undefined {
	if (!isRecord(error) || depth > 3) {
		return undefined;
	}

	const directCode = asTrpcErrorCode(error.code);
	if (error.name === "TRPCError" && directCode) {
		return directCode;
	}

	if (error.name === "TRPCClientError" && isRecord(error.data)) {
		const clientCode = asTrpcErrorCode(error.data.code);
		if (clientCode) {
			return clientCode;
		}
	}

	return getCodeFromException(error.cause, depth + 1);
}

function getTrpcExceptions(event: SentryEventLike): SentryExceptionLike[] {
	return (
		event.exception?.values?.filter(
			(exception) =>
				exception.type === "TRPCError" || exception.type === "TRPCClientError",
		) ?? []
	);
}

/** Resolve the tRPC code from the original error or from tags we added earlier. */
export function getTrpcErrorCode(
	event: SentryEventLike,
	hint?: SentryHintLike,
): TrpcErrorCode | undefined {
	return (
		getCodeFromException(hint?.originalException) ??
		asTrpcErrorCode(event.tags?.trpcErrorCode)
	);
}

/** Add filterable context without changing whether the event is reported. */
export function tagTrpcError(
	event: SentryEventLike,
	hint?: SentryHintLike,
): void {
	const code = getTrpcErrorCode(event, hint);
	if (!code) {
		return;
	}

	event.tags = {
		...event.tags,
		trpcErrorCode: code,
		trpcClientError: code === "INTERNAL_SERVER_ERROR" ? "false" : "true",
	};
}

/** Returns true for expected tRPC outcomes that should not page the team. */
export function isExpectedTrpcError(
	event: SentryEventLike,
	hint?: SentryHintLike,
): boolean {
	const exceptions = getTrpcExceptions(event);
	if (exceptions.length === 0) {
		return false;
	}

	const code = getTrpcErrorCode(event, hint);
	if (code && ALWAYS_EXPECTED_CODES.has(code)) {
		return true;
	}

	return exceptions.some((exception) =>
		EXPECTED_ERROR_SIGNATURES.some((signature) => {
			if (signature.code && code && signature.code !== code) {
				return false;
			}

			const message = exception.value ?? "";
			return signature.exact
				? message === signature.exact
				: Boolean(
						signature.startsWith && message.startsWith(signature.startsWith),
					);
		}),
	);
}
