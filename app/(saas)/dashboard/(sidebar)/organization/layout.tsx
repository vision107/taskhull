import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type * as React from "react";

import { ActivateOrganization } from "@/components/organization/activate-organization";
import { OrganizationMenuItems } from "@/components/organization/organization-menu-items";
import { OrganizationMobileNav } from "@/components/organization/organization-mobile-nav";
import { SidebarLayout } from "@/components/sidebar-layout";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { shouldRedirectToChoosePlan } from "@/lib/billing/guards";
import { db } from "@/lib/db";
import { memberTable } from "@/lib/db/schema/tables";
import { canPlan } from "@/lib/manufacturing/permissions";

import { OrganizationProviders } from "./providers";

export type OrganizationLayoutProps = React.PropsWithChildren;

/**
 * Organization layout that requires an active organization in the session.
 * Users who belong to exactly one organization get it activated in place (so
 * deep links from notifications work on a fresh device); everyone else is
 * sent to /dashboard to pick one.
 * If billing requires a plan and none is active, redirects to /dashboard/choose-plan.
 */
export default async function OrganizationLayout({
	children,
}: OrganizationLayoutProps): Promise<React.JSX.Element> {
	const session = await getSession();

	// If no session, the auth middleware will handle redirect
	if (!session) {
		redirect("/auth/sign-in");
	}

	const activeOrganizationId = session.session.activeOrganizationId;
	if (!activeOrganizationId) {
		const memberships = await db.query.memberTable.findMany({
			where: eq(memberTable.userId, session.user.id),
			columns: { organizationId: true },
		});
		if (memberships.length === 1 && memberships[0]) {
			return (
				<ActivateOrganization
					organizationId={memberships[0].organizationId}
					redirectTo="/dashboard/start"
				/>
			);
		}
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

	const membership = organization.members.find(
		(member) => member.userId === session.user.id,
	);
	const cookieStore = await cookies();

	return (
		<OrganizationProviders organization={organization}>
			<SidebarLayout
				defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
				defaultWidth={cookieStore.get("sidebar_width")?.value}
				menuItems={
					<OrganizationMenuItems canPlan={canPlan(membership?.role)} />
				}
				mobileNav={
					<OrganizationMobileNav canPlan={canPlan(membership?.role)} />
				}
			>
				{children}
			</SidebarLayout>
		</OrganizationProviders>
	);
}
