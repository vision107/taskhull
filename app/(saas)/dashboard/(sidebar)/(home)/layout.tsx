import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import type * as React from "react";

import { OrganizationMobileNav } from "@/components/organization/organization-mobile-nav";
import { SidebarLayout } from "@/components/sidebar-layout";
import { UserMenuItems } from "@/components/user/user-menu-items";
import { UserMobileNav } from "@/components/user/user-mobile-nav";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { memberTable } from "@/lib/db/schema/tables";
import { canPlan } from "@/lib/manufacturing/permissions";

/**
 * Account area (home, inbox, settings). On a phone the tab bar stays the
 * organization's tabs when one is active, so switching between My tasks and
 * the Inbox never changes the navigation under the thumb.
 */
async function MobileNav(): Promise<React.JSX.Element> {
	const session = await getSession();
	const activeOrganizationId = session?.session.activeOrganizationId;
	if (!session || !activeOrganizationId) return <UserMobileNav />;

	const membership = await db.query.memberTable.findFirst({
		where: and(
			eq(memberTable.organizationId, activeOrganizationId),
			eq(memberTable.userId, session.user.id),
		),
		columns: { role: true },
	});
	if (!membership) return <UserMobileNav />;

	return <OrganizationMobileNav canPlan={canPlan(membership.role)} />;
}

export default async function AccountLayout({
	children,
}: React.PropsWithChildren): Promise<React.JSX.Element> {
	const cookieStore = await cookies();
	return (
		<SidebarLayout
			defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
			defaultWidth={cookieStore.get("sidebar_width")?.value}
			menuItems={<UserMenuItems />}
			mobileNav={<MobileNav />}
		>
			{children}
		</SidebarLayout>
	);
}
