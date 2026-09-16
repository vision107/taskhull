import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";

import { ActivateOrganization } from "@/components/organization/activate-organization";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { memberTable } from "@/lib/db/schema/tables";
import { homeForRole } from "@/lib/manufacturing/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Loading…",
};

/**
 * Post sign-in landing. Everyone uses the same shell; planners land on the
 * organization dashboard, workers on their task list. Only users with several
 * organizations (or none yet) see the organization picker.
 */
export default async function StartPage(): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session) {
		redirect("/auth/sign-in?redirectTo=%2Fdashboard%2Fstart");
	}

	const memberships = await db.query.memberTable.findMany({
		where: eq(memberTable.userId, session.user.id),
		columns: { organizationId: true, role: true },
	});

	if (memberships.length === 0) {
		redirect("/dashboard");
	}

	const activeId = session.session.activeOrganizationId ?? null;
	const activeMembership = activeId
		? memberships.find((m) => m.organizationId === activeId)
		: undefined;

	if (activeMembership) {
		redirect(homeForRole(activeMembership.role));
	}

	// Exactly one organization: activate it and go straight in.
	if (memberships.length === 1 && memberships[0]) {
		return (
			<ActivateOrganization
				organizationId={memberships[0].organizationId}
				redirectTo={homeForRole(memberships[0].role)}
			/>
		);
	}

	redirect("/dashboard");
}
