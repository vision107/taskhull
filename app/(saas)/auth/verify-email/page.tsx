import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";

import { EmailVerificationCard } from "@/components/auth/email-verification-card";
import { EmailVerificationResultCard } from "@/components/auth/email-verification-result-card";
import { authConfig } from "@/config/auth.config";
import {
	getEmailVerificationError,
	getEmailVerificationErrorMessage,
} from "@/lib/auth/email-verification";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/server";

export const metadata: Metadata = {
	title: "Verify email",
};

type VerifyEmailPageProps = {
	searchParams: Promise<{
		error?: string | string[];
		email?: string | string[];
		redirectTo?: string | string[];
		status?: string | string[];
	}>;
};

function first(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyEmailPage({
	searchParams,
}: VerifyEmailPageProps): Promise<React.JSX.Element> {
	const params = await searchParams;
	const redirectTo = getSafeRedirectPath(
		first(params.redirectTo),
		authConfig.redirectAfterSignIn,
	);
	const error = getEmailVerificationError(params.error);
	const email = first(params.email);

	if (error) {
		return (
			<EmailVerificationCard
				errorMessage={getEmailVerificationErrorMessage(error)}
				redirectTo={redirectTo}
				showSignUpAgain={error === "USER_NOT_FOUND" && authConfig.enableSignup}
			/>
		);
	}

	if (first(params.status) !== "verified") {
		if (!email) {
			redirect("/auth/sign-in");
		}

		return (
			<EmailVerificationCard
				email={email}
				redirectTo={redirectTo}
				showSignUpAgain
			/>
		);
	}

	const session = await getSession();

	return (
		<EmailVerificationResultCard
			redirectTo={redirectTo}
			verifiedNow={Boolean(session)}
		/>
	);
}
