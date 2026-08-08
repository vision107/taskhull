"use client";

import { parseAsString, useQueryState } from "nuqs";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authConfig } from "@/config/auth.config";
import { authClient } from "@/lib/auth/client";
import { oAuthProviders } from "@/lib/auth/oauth-providers";
import { cn } from "@/lib/utils";

export type SocialSigninButtonProps =
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		provider: keyof typeof oAuthProviders;
	};

export function SocialSigninButton({
	provider,
	className,
	...props
}: SocialSigninButtonProps): React.JSX.Element {
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const [isSigningIn, setIsSigningIn] = React.useState(false);
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/app/organization-invitation/${invitationId}`
		: authConfig.redirectAfterSignIn;

	const onSignin = async () => {
		const callbackURL = new URL(redirectPath, window.location.origin);

		setIsSigningIn(true);

		try {
			const { error } = await authClient.signIn.social({
				provider,
				callbackURL: callbackURL.toString(),
			});

			if (error) {
				const message =
					error.status >= 500
						? `${providerData.name} sign-in is unavailable. Check the OAuth configuration and try again.`
						: error.message || `${providerData.name} sign-in failed.`;

				toast.error(message);
			}
		} catch {
			toast.error(
				`${providerData.name} sign-in is unavailable. Check the OAuth configuration and try again.`,
			);
		} finally {
			setIsSigningIn(false);
		}
	};

	return (
		<Button
			{...props}
			loading={isSigningIn}
			onClick={() => void onSignin()}
			type="button"
			variant="outline"
			className={cn("w-full gap-2", className)}
		>
			{providerData.icon && <providerData.icon className="size-4 shrink-0" />}
			<span>{providerData.name}</span>
		</Button>
	);
}
