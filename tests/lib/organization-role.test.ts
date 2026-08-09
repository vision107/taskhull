import {
	adminAc,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";
import { describe, expect, it } from "vitest";

import {
	canChangeOrganizationRole,
	canDeleteOrganization,
	canManageOrganizationBilling,
	canManageOrganizationMembers,
	canUploadOrganizationLogo,
} from "@/lib/auth/organization-permissions";
import { isOrganizationAdmin, isOrganizationOwner } from "@/lib/auth/utils";

const organization = {
	members: [
		{ userId: "owner-user", role: "owner" },
		{ userId: "admin-user", role: "admin" },
		{ userId: "member-user", role: "member" },
	],
} as Parameters<typeof isOrganizationOwner>[0];

describe("organization role permissions", () => {
	const roles = ["owner", "admin", "member", undefined] as const;

	it.each([
		["delete organization", canDeleteOrganization, [true, false, false, false]],
		[
			"manage billing",
			canManageOrganizationBilling,
			[true, true, false, false],
		],
		[
			"invite or revoke members",
			canManageOrganizationMembers,
			[true, true, false, false],
		],
		[
			"upload organization logo",
			canUploadOrganizationLogo,
			[true, true, false, false],
		],
	] as const)(
		"applies the owner/admin matrix for %s",
		(_name, check, expected) => {
			expect(roles.map((role) => check(role))).toEqual(expected);
		},
	);

	it("limits organization-admin role changes", () => {
		expect(
			canChangeOrganizationRole({
				actorRole: "admin",
				currentRole: "member",
				nextRole: "admin",
			}),
		).toBe(true);
		expect(
			canChangeOrganizationRole({
				actorRole: "admin",
				currentRole: "owner",
				nextRole: "member",
			}),
		).toBe(false);
		expect(
			canChangeOrganizationRole({
				actorRole: "admin",
				currentRole: "member",
				nextRole: "owner",
			}),
		).toBe(false);
		expect(
			canChangeOrganizationRole({
				actorRole: "member",
				currentRole: "member",
				nextRole: "admin",
			}),
		).toBe(false);
	});

	it("matches Better Auth's enforced member and organization permissions", () => {
		const managedActions = {
			organization: ["update"],
			member: ["create", "update", "delete"],
			invitation: ["create", "cancel"],
		} as const;

		expect(ownerAc.authorize(managedActions).success).toBe(true);
		expect(adminAc.authorize(managedActions).success).toBe(true);
		expect(memberAc.authorize(managedActions).success).toBe(false);
		expect(ownerAc.authorize({ organization: ["delete"] }).success).toBe(true);
		expect(adminAc.authorize({ organization: ["delete"] }).success).toBe(false);
		expect(memberAc.authorize({ organization: ["delete"] }).success).toBe(
			false,
		);
	});
	it("grants organization deletion only to the owner", () => {
		expect(isOrganizationOwner(organization, { id: "owner-user" })).toBe(true);
		expect(isOrganizationOwner(organization, { id: "admin-user" })).toBe(false);
		expect(isOrganizationOwner(organization, { id: "member-user" })).toBe(
			false,
		);
	});

	it("does not treat a global admin as the organization owner", () => {
		const globalAdmin = { id: "admin-user", role: "admin" };

		expect(isOrganizationAdmin(organization, globalAdmin)).toBe(true);
		expect(isOrganizationOwner(organization, globalAdmin)).toBe(false);
		expect(
			isOrganizationAdmin(organization, {
				id: "outsider-user",
				role: "admin",
			}),
		).toBe(false);
	});
});
