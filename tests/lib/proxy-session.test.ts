import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth";
import proxy, { getSession } from "@/proxy";

describe("proxy session lookup", () => {
	it("uses Better Auth directly with the incoming request headers", async () => {
		const request = new NextRequest("https://public.example.com/dashboard", {
			headers: {
				cookie: "better-auth.session_token=session-token",
				"x-forwarded-host": "public.example.com",
				"x-forwarded-proto": "https",
			},
		});
		const getAuthSession = vi.mocked(auth.api.getSession);

		await getSession(request);

		expect(getAuthSession).toHaveBeenCalledWith({
			headers: request.headers,
			query: {
				disableCookieCache: true,
			},
		});
	});

	it("routes legacy verification callback errors to the recovery screen", async () => {
		const response = await proxy(
			new NextRequest(
				"https://public.example.com/dashboard?error=TOKEN_EXPIRED",
			),
		);

		expect(response.headers.get("location")).toBe(
			"https://public.example.com/auth/verify-email?error=TOKEN_EXPIRED&redirectTo=%2Fdashboard",
		);
	});
});
