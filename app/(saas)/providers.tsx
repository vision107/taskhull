"use client";

import NiceModal from "@ebay/nice-modal-react";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type * as React from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appConfig } from "@/config/app.config";
import { ThemeProvider } from "@/hooks/use-theme";

interface SaaSProvidersProps extends React.PropsWithChildren {}

/**
 * SaaS-specific providers.
 * Full-featured with auth, organization context, and TRPC integration.
 */
export function SaaSProviders({
	children,
}: SaaSProvidersProps): React.JSX.Element {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme={appConfig.theme.saas.default}
			disableTransitionOnChange
			enableSystem
			storageKey={appConfig.theme.saas.storageKey}
			themes={[...appConfig.theme.saas.available]}
		>
			<NuqsAdapter>
				<NextTopLoader color="var(--color-primary)" />
				<TooltipProvider>
					<NiceModal.Provider>{children}</NiceModal.Provider>
				</TooltipProvider>
				<Toaster position="top-right" />
			</NuqsAdapter>
		</ThemeProvider>
	);
}
