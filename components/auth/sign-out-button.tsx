"use client";

import * as React from "react";

import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";

export function SignOutButton({
	className,
}: {
	className?: string;
}): React.JSX.Element {
	const signOut = useSignOut();
	const [isSigningOut, setIsSigningOut] = React.useState(false);

	const handleClick = async () => {
		setIsSigningOut(true);
		await signOut();
	};

	return (
		<button
			className={cn(
				"cursor-pointer font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-60",
				className,
			)}
			disabled={isSigningOut}
			onClick={handleClick}
			type="button"
		>
			{isSigningOut ? "Signing out…" : "Sign out"}
		</button>
	);
}
