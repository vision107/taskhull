import { redirect } from "next/navigation";

import { getOrganizationById, getSession } from "@/lib/auth/server";
import { canPlan } from "@/lib/manufacturing/permissions";

/**
 * Resolves the active organization and the current user's planning permission
 * for planner pages. Redirects to the dashboard when no organization is active.
 */
export async function getPlannerPageContext() {
	const session = await getSession();
	if (!session?.session.activeOrganizationId) {
		redirect("/dashboard");
	}

	const organization = await getOrganizationById(
		session.session.activeOrganizationId,
	);
	if (!organization) {
		redirect("/dashboard");
	}

	const membership = organization.members.find(
		(member) => member.userId === session.user.id,
	);

	return {
		session,
		organization,
		membership,
		canPlan: canPlan(membership?.role),
	};
}
