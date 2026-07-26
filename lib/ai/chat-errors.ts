export const AI_CHAT_ERROR_MESSAGES = {
	quota:
		"AI is temporarily unavailable because the provider quota has been reached.",
	authentication:
		"AI is unavailable because the provider credentials are not configured correctly.",
	model:
		"The selected AI model is not available to the configured provider project.",
	rateLimit: "AI is receiving too many requests. Please try again shortly.",
	unknown: "AI is temporarily unavailable. Please try again later.",
} as const;

function collectErrorText(error: unknown, depth = 0): string {
	if (depth > 3 || error == null) return "";
	if (typeof error === "string") return error;
	if (error instanceof Error) {
		const cause =
			"cause" in error ? collectErrorText(error.cause, depth + 1) : "";
		return `${error.name} ${error.message} ${cause}`;
	}
	if (
		typeof error === "number" ||
		typeof error === "bigint" ||
		typeof error === "boolean" ||
		typeof error === "symbol" ||
		typeof error === "undefined"
	) {
		return String(error);
	}
	if (typeof error !== "object") return "";

	const value = error as Record<string, unknown>;
	return [
		value.name,
		value.message,
		value.statusCode,
		value.responseBody,
		value.cause,
		value.lastError,
	]
		.map((part) => collectErrorText(part, depth + 1))
		.join(" ");
}

export function getSafeAIChatErrorMessage(error: unknown): string {
	const details = collectErrorText(error).toLowerCase();

	if (
		details.includes("insufficient_quota") ||
		details.includes("exceeded your current quota") ||
		details.includes("billing_hard_limit_reached")
	) {
		return AI_CHAT_ERROR_MESSAGES.quota;
	}

	if (
		details.includes("invalid_api_key") ||
		details.includes("incorrect api key") ||
		details.includes("invalid authentication") ||
		details.includes("statuscode 401")
	) {
		return AI_CHAT_ERROR_MESSAGES.authentication;
	}

	if (
		details.includes("model_not_found") ||
		details.includes("does not exist or you do not have access")
	) {
		return AI_CHAT_ERROR_MESSAGES.model;
	}

	if (
		details.includes("rate_limit_exceeded") ||
		details.includes("rate limit") ||
		details.includes("too many requests")
	) {
		return AI_CHAT_ERROR_MESSAGES.rateLimit;
	}

	return AI_CHAT_ERROR_MESSAGES.unknown;
}
