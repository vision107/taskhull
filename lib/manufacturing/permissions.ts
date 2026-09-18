import { TRPCError } from "@trpc/server";

/**
 * Planners (org owner/admin) manage templates, products, builds and
 * assignments. Workers (org member) execute the tasks assigned to them. Both
 * use the same dashboard; the role only decides what can be edited.
 */
export function canPlan(role?: string | null): boolean {
	return role === "owner" || role === "admin";
}

/** Where a member lands inside their organization, by role. */
export function homeForRole(role?: string | null): string {
	return canPlan(role)
		? "/dashboard/organization"
		: "/dashboard/organization/my-tasks";
}

export function assertCanPlan(role?: string | null): void {
	if (canPlan(role)) return;
	throw new TRPCError({
		code: "FORBIDDEN",
		message: "Only organization owners and admins can do this.",
	});
}
