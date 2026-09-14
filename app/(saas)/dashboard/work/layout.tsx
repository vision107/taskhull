import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";

import { OfflineProvider } from "@/components/work/offline-provider";
import { WorkBottomNav } from "@/components/work/work-bottom-nav";
import { WorkHeader } from "@/components/work/work-header";
import { WorkLocaleProvider } from "@/components/work/work-locale-provider";
import { WorkOrganizationPicker } from "@/components/work/work-org-picker";
import { appConfig } from "@/config/app.config";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { canPlan } from "@/lib/manufacturing/permissions";

export const metadata: Metadata = {
	title: {
		default: appConfig.appName,
		template: `%s | ${appConfig.appName}`,
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: appConfig.appName,
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
};

/**
 * Phone-first shell for workers. No sidebar; a slim header, safe-area padding
 * and a narrow column that also looks fine on a desktop browser.
 */
export default async function WorkLayout({
	children,
}: React.PropsWithChildren): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session) {
		redirect("/auth/sign-in?redirectTo=/dashboard/work");
	}

	const organization = session.session.activeOrganizationId
		? await getOrganizationById(session.session.activeOrganizationId)
		: null;
	const membership = organization?.members.find(
		(member) => member.userId === session.user.id,
	);

	const userLocale =
		(session.user as { locale?: string | null }).locale ?? null;
	const isPlanner = canPlan(membership?.role);
	const hasBottomNav = isPlanner && organization !== null;

	return (
		<WorkLocaleProvider initialLocale={userLocale}>
			<OfflineProvider>
				<div
					className="flex min-h-dvh flex-col bg-muted/30"
					style={
						{
							// Height of the tab bar (incl. safe area) so fixed elements
							// such as the task action bar can sit on top of it.
							"--work-nav": hasBottomNav
								? "calc(3.5rem + env(safe-area-inset-bottom))"
								: "0px",
						} as React.CSSProperties
					}
				>
					<WorkHeader
						organizationName={organization?.name ?? ""}
						user={{
							name: session.user.name,
							email: session.user.email,
							image: session.user.image ?? null,
						}}
						canPlan={isPlanner}
					/>
					<main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-3 pb-[max(calc(var(--work-nav)+1.5rem),env(safe-area-inset-bottom))]">
						{organization ? children : <WorkOrganizationPicker />}
					</main>
					{hasBottomNav && <WorkBottomNav />}
				</div>
			</OfflineProvider>
		</WorkLocaleProvider>
	);
}
