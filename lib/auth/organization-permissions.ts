export type OrganizationRole = "owner" | "admin" | "member";

export function canDeleteOrganization(role?: string | null): boolean {
	return role === "owner";
}

export function canManageOrganizationBilling(role?: string | null): boolean {
	return role === "owner" || role === "admin";
}

export function canManageOrganizationMembers(role?: string | null): boolean {
	return role === "owner" || role === "admin";
}

export function canUploadOrganizationLogo(role?: string | null): boolean {
	return role === "owner" || role === "admin";
}

export function canChangeOrganizationRole({
	actorRole,
	currentRole,
	nextRole,
}: {
	actorRole?: string | null;
	currentRole: string;
	nextRole: string;
}): boolean {
	if (actorRole === "owner") {
		return true;
	}

	return (
		actorRole === "admin" && currentRole !== "owner" && nextRole !== "owner"
	);
}
