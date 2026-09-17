import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type * as React from "react";

import { OrganizationMenuItems } from "@/components/organization/organization-menu-items";
import { SidebarLayout } from "@/components/sidebar-layout";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { shouldRedirectToChoosePlan } from "@/lib/billing/guards";

import { OrganizationProviders } from "./providers";

export type WorkspaceLayoutProps = React.PropsWithChildren;

/**
 * Sidebar shell for everything a signed-in user does in the web app: the
 * organization pages under /dashboard/organization and the account settings
 * at /dashboard/settings. Always renders the organization sidebar so the
 * navigation never changes shape.
 *
 * Requires an active organization in the session; otherwise redirects to
 * /dashboard, which picks or lets the user choose one. If billing requires a
 * plan and none is active, redirects to /dashboard/choose-plan.
 */
export default async function WorkspaceLayout({
	children,
}: WorkspaceLayoutProps): Promise<React.JSX.Element> {
	const session = await getSession();

	// If no session, the auth middleware will handle redirect
	if (!session) {
		redirect("/auth/sign-in");
	}

	// If no active organization, redirect to dashboard to select one
	const activeOrganizationId = session.session.activeOrganizationId;
	if (!activeOrganizationId) {
		redirect("/dashboard");
	}

	// Get the active organization details
	const organization = await getOrganizationById(activeOrganizationId);
	if (!organization) {
		// Active organization no longer exists, redirect to dashboard
		redirect("/dashboard");
	}

	// Check if user needs to choose a plan before accessing organization
	const needsToChoosePlan = await shouldRedirectToChoosePlan(organization.id);
	if (needsToChoosePlan) {
		redirect("/dashboard/choose-plan");
	}

	const cookieStore = await cookies();

	return (
		<OrganizationProviders organization={organization}>
			<SidebarLayout
				defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
				defaultWidth={cookieStore.get("sidebar_width")?.value}
				menuItems={<OrganizationMenuItems />}
			>
				{children}
			</SidebarLayout>
		</OrganizationProviders>
	);
}
