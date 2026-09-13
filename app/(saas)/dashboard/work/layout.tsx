import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";

import { OfflineProvider } from "@/components/work/offline-provider";
import { WorkHeader } from "@/components/work/work-header";
import { WorkOrganizationPicker } from "@/components/work/work-org-picker";
import { appConfig } from "@/config/app.config";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { canPlan } from "@/lib/manufacturing/permissions";

export const metadata: Metadata = {
	title: {
		default: "My tasks",
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

	return (
		<OfflineProvider>
			<div className="flex min-h-dvh flex-col bg-muted/30">
				<WorkHeader
					organizationName={organization?.name ?? ""}
					user={{
						name: session.user.name,
						email: session.user.email,
						image: session.user.image ?? null,
					}}
					canPlan={canPlan(membership?.role)}
				/>
				<main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
					{organization ? children : <WorkOrganizationPicker />}
				</main>
			</div>
		</OfflineProvider>
	);
}
