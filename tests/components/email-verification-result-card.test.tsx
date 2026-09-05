import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmailVerificationResultCard } from "@/components/auth/email-verification-result-card";

describe("EmailVerificationResultCard", () => {
	it("continues a newly verified session to its safe destination", () => {
		const markup = renderToStaticMarkup(
			<EmailVerificationResultCard
				redirectTo="/dashboard/settings"
				verifiedNow
			/>,
		);

		expect(markup).toContain("Email verified");
		expect(markup).toContain("<h1>Email verified</h1>");
		expect(markup).toContain('href="/dashboard/settings"');
	});

	it("explains a reused link while signed out and returns to sign in", () => {
		const markup = renderToStaticMarkup(
			<EmailVerificationResultCard
				redirectTo="/dashboard/settings"
				verifiedNow={false}
			/>,
		);

		expect(markup).toContain("Email already verified");
		expect(markup).toContain("<h1>Email already verified</h1>");
		expect(markup).toContain(
			'href="/auth/sign-in?redirectTo=%2Fdashboard%2Fsettings"',
		);
	});
});
