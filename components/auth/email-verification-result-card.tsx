import { CheckCircle2Icon, InfoIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { withQuery } from "ufo";

import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

type EmailVerificationResultCardProps = {
	redirectTo: string;
	verifiedNow: boolean;
};

export function EmailVerificationResultCard({
	redirectTo,
	verifiedNow,
}: EmailVerificationResultCardProps): React.JSX.Element {
	const Icon = verifiedNow ? CheckCircle2Icon : InfoIcon;

	return (
		<Card className="w-full border-transparent px-0 py-8 [--card-spacing:--spacing(8)] dark:border-border">
			<CardHeader>
				<div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
					<Icon className="size-5" />
				</div>
				<CardTitle className="text-base lg:text-lg">
					{verifiedNow ? "Email verified" : "Email already verified"}
				</CardTitle>
				<CardDescription>
					{verifiedNow
						? "Your email address is verified and your account is ready."
						: "This email address was already verified. Sign in to continue."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Link
					className={buttonVariants({ className: "w-full" })}
					href={
						verifiedNow
							? redirectTo
							: withQuery("/auth/sign-in", { redirectTo })
					}
				>
					{verifiedNow ? "Continue" : "Sign in"}
				</Link>
			</CardContent>
		</Card>
	);
}
