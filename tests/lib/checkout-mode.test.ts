import { describe, expect, it } from "vitest";

import {
	buildCheckoutRedirectParams,
	buildCheckoutResult,
} from "@/lib/billing/checkout";

describe("Stripe Checkout mode", () => {
	it("uses a return URL without hosted redirect URLs for embedded checkout", () => {
		expect(
			buildCheckoutRedirectParams(
				"embedded",
				"https://example.com/return",
				"https://example.com/cancel",
			),
		).toEqual({
			ui_mode: "embedded",
			return_url: "https://example.com/return",
		});
	});

	it("uses success and cancel URLs for hosted checkout", () => {
		expect(
			buildCheckoutRedirectParams(
				"hosted",
				"https://example.com/return",
				"https://example.com/cancel",
			),
		).toEqual({
			ui_mode: "hosted",
			success_url: "https://example.com/return",
			cancel_url: "https://example.com/cancel",
		});
	});

	it("returns a client secret for embedded checkout", () => {
		expect(
			buildCheckoutResult("embedded", {
				id: "cs_test_embedded",
				client_secret: "cs_test_secret",
				url: null,
			}),
		).toEqual({
			mode: "embedded",
			clientSecret: "cs_test_secret",
			sessionId: "cs_test_embedded",
		});
	});

	it("returns a URL for hosted checkout", () => {
		expect(
			buildCheckoutResult("hosted", {
				id: "cs_test_hosted",
				client_secret: null,
				url: "https://checkout.stripe.com/example",
			}),
		).toEqual({
			mode: "hosted",
			url: "https://checkout.stripe.com/example",
			sessionId: "cs_test_hosted",
		});
	});

	it("rejects incomplete responses for each mode", () => {
		expect(() =>
			buildCheckoutResult("embedded", {
				id: "cs_test_embedded",
				client_secret: null,
				url: null,
			}),
		).toThrow("no client secret returned");

		expect(() =>
			buildCheckoutResult("hosted", {
				id: "cs_test_hosted",
				client_secret: null,
				url: null,
			}),
		).toThrow("no URL returned");
	});
});
