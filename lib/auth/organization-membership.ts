export type LeaveOrganizationRestriction = "only-member" | "only-owner";

export const ONLY_MEMBER_LEAVE_MESSAGE =
	"You cannot leave as the organization's only member. Delete the organization instead.";
export const ONLY_OWNER_LEAVE_MESSAGE =
	"Transfer ownership to another member before leaving.";

type OrganizationMember = {
	role: string;
	userId: string;
};

export function getLeaveOrganizationRestriction(
	members: readonly OrganizationMember[],
	userId: string,
): LeaveOrganizationRestriction | null {
	const member = members.find((candidate) => candidate.userId === userId);
	if (!member) return null;

	if (members.length === 1) {
		return "only-member";
	}

	if (
		member.role === "owner" &&
		!members.some(
			(candidate) => candidate.userId !== userId && candidate.role === "owner",
		)
	) {
		return "only-owner";
	}

	return null;
}

export function getLeaveOrganizationRestrictionMessage(
	restriction: LeaveOrganizationRestriction,
): string {
	return restriction === "only-owner"
		? ONLY_OWNER_LEAVE_MESSAGE
		: ONLY_MEMBER_LEAVE_MESSAGE;
}

export function isOnlyOwnerLeaveError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;

	const code = "code" in error ? String(error.code) : "";
	const message = "message" in error ? String(error.message) : "";

	return (
		code === "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER" ||
		message.toLowerCase().includes("only owner")
	);
}
