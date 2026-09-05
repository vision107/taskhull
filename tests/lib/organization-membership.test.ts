import { describe, expect, it } from "vitest";

import {
	getLeaveOrganizationRestriction,
	isOnlyOwnerLeaveError,
} from "@/lib/auth/organization-membership";

const owner = { role: "owner", userId: "owner-1" };

describe("leave organization restrictions", () => {
	it("blocks the organization's only member", () => {
		expect(getLeaveOrganizationRestriction([owner], owner.userId)).toBe(
			"only-member",
		);
	});

	it("blocks the only owner while other members remain", () => {
		expect(
			getLeaveOrganizationRestriction(
				[owner, { role: "member", userId: "member-1" }],
				owner.userId,
			),
		).toBe("only-owner");
	});

	it("allows an owner to leave when another owner remains", () => {
		expect(
			getLeaveOrganizationRestriction(
				[owner, { role: "owner", userId: "owner-2" }],
				owner.userId,
			),
		).toBeNull();
	});

	it("allows a non-owner to leave", () => {
		expect(
			getLeaveOrganizationRestriction(
				[owner, { role: "member", userId: "member-1" }],
				"member-1",
			),
		).toBeNull();
	});

	it("recognizes Better Auth's sole-owner rejection", () => {
		expect(
			isOnlyOwnerLeaveError({
				code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER",
			}),
		).toBe(true);
		expect(
			isOnlyOwnerLeaveError({
				message: "You cannot leave the organization as the only owner",
			}),
		).toBe(true);
		expect(isOnlyOwnerLeaveError(new Error("Network unavailable"))).toBe(false);
	});
});
