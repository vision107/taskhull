import type { Metadata, Viewport } from "next";
import type * as React from "react";

import { OfflineProvider } from "@/components/work/offline-provider";
import { WorkLocaleProvider } from "@/components/work/work-locale-provider";
import { appConfig } from "@/config/app.config";
import { getSession } from "@/lib/auth/server";

export const metadata: Metadata = {
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: appConfig.appName,
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
};

/**
 * Shared shell for every signed-in dashboard page. Owns the things that used
 * to live only in the worker PWA: the user's language, the offline write
 * queue and the service worker registration, so the same pages work at a
 * desk and on a phone on the shop floor.
 */
export default async function DashboardShellLayout({
	children,
}: React.PropsWithChildren): Promise<React.JSX.Element> {
	const session = await getSession();
	const userLocale =
		(session?.user as { locale?: string | null } | undefined)?.locale ?? null;

	return (
		<WorkLocaleProvider initialLocale={userLocale}>
			<OfflineProvider>{children}</OfflineProvider>
		</WorkLocaleProvider>
	);
}
