import { TRPCError } from "@trpc/server";

/**
 * Planners (org owner/admin) manage templates, products, builds and
 * assignments from the web dashboard. Workers (org member) execute tasks
 * assigned to them from the PWA.
 */
export function canPlan(role?: string | null): boolean {
	return role === "owner" || role === "admin";
}

export function assertCanPlan(role?: string | null): void {
	if (canPlan(role)) return;
	throw new TRPCError({
		code: "FORBIDDEN",
		message: "Only organization owners and admins can do this.",
	});
}
