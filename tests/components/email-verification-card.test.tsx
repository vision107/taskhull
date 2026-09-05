import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmailVerificationCard } from "@/components/auth/email-verification-card";

describe("EmailVerificationCard", () => {
	it("renders a refresh-safe pending state with custom form validation", () => {
		const markup = renderToStaticMarkup(
			<EmailVerificationCard
				email="person@example.com"
				redirectTo="/dashboard"
				showSignUpAgain
			/>,
		);

		expect(markup).toContain("Verify your email");
		expect(markup).toContain("person@example.com");
		expect(markup).toContain('noValidate=""');
		expect(markup).toContain("Resend verification email");
		expect(markup).toContain("Sign up again");
	});

	it("asks for an email when recovering from an expired link", () => {
		const markup = renderToStaticMarkup(
			<EmailVerificationCard
				errorMessage="This verification link has expired."
				redirectTo="/dashboard"
			/>,
		);

		expect(markup).toContain("Verification link issue");
		expect(markup).toContain('type="email"');
		expect(markup).not.toContain("Sign up again");
	});
});
