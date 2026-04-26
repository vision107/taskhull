"use client";

import type * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/use-theme";
import { TRPCProvider } from "@/trpc/client";

interface MobileProvidersProps extends React.PropsWithChildren {
	session: {
		session: { activeOrganizationId?: string | null };
	};
}

export function MobileProviders({
	children,
	session,
}: MobileProvidersProps): React.JSX.Element {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
		>
			<TRPCProvider
				organizationId={session.session.activeOrganizationId}
			>
				{children}
				<Toaster position="top-center" />
			</TRPCProvider>
		</ThemeProvider>
	);
}
