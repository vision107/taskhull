import { describe, expect, it } from "vitest";
import {
	AI_CHAT_ERROR_MESSAGES,
	getSafeAIChatErrorMessage,
} from "@/lib/ai/chat-errors";

describe("getSafeAIChatErrorMessage", () => {
	it("maps a nested quota failure without exposing provider details", () => {
		const error = new Error(
			"Failed after 3 attempts. Last error: You exceeded your current quota.",
		);
		expect(getSafeAIChatErrorMessage(error)).toBe(AI_CHAT_ERROR_MESSAGES.quota);
	});

	it("maps invalid credentials", () => {
		expect(
			getSafeAIChatErrorMessage({
				statusCode: 401,
				responseBody: '{"code":"invalid_api_key"}',
			}),
		).toBe(AI_CHAT_ERROR_MESSAGES.authentication);
	});

	it("maps unavailable models", () => {
		expect(getSafeAIChatErrorMessage("model_not_found")).toBe(
			AI_CHAT_ERROR_MESSAGES.model,
		);
	});

	it("uses a generic message for unknown failures", () => {
		expect(
			getSafeAIChatErrorMessage(new Error("private upstream detail")),
		).toBe(AI_CHAT_ERROR_MESSAGES.unknown);
	});
});
