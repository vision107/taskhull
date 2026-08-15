type SentryEventLike = {
	exception?: {
		values?: Array<{
			type?: string;
			value?: string;
		}>;
	};
};

const EXPECTED_TRPC_ERROR_MESSAGES = new Set([
	"Only organization owners and admins can manage billing",
]);

/** Returns true for expected authorization rejections that should not page us. */
export function isExpectedTrpcError(event: SentryEventLike): boolean {
	return Boolean(
		event.exception?.values?.some(
			(exception) =>
				exception.type === "TRPCError" &&
				Boolean(
					exception.value && EXPECTED_TRPC_ERROR_MESSAGES.has(exception.value),
				),
		),
	);
}
