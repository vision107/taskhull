import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";

import { ActivateOrganization } from "@/components/organization/activate-organization";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { memberTable } from "@/lib/db/schema/tables";
import { canPlan } from "@/lib/manufacturing/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Loading…",
};

/**
 * Post sign-in landing. Sends workers straight to their task list and
 * planners to their organization's dashboard; only users with several
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

	const planning = memberships.filter((m) => canPlan(m.role));

	// Worker everywhere → phone task list (it picks the organization itself).
	if (planning.length === 0) {
		redirect("/dashboard/work");
	}

	const activeId = session.session.activeOrganizationId ?? null;
	const activeMembership = activeId
		? memberships.find((m) => m.organizationId === activeId)
		: undefined;

	if (activeMembership && canPlan(activeMembership.role)) {
		redirect("/dashboard/organization");
	}

	// Planner in exactly one organization: activate it and go there.
	if (planning.length === 1 && planning[0]) {
		return (
			<ActivateOrganization
				organizationId={planning[0].organizationId}
				redirectTo="/dashboard/organization"
			/>
		);
	}

	redirect("/dashboard");
}
