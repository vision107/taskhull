import { inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { findSoleOwnedOrganizations } from "@/lib/auth/account-deletion";
import { db, memberTable, organizationTable, userTable } from "@/lib/db";
import { MemberRole } from "@/lib/db/schema/enums";

const userIds = [
	"91000000-0000-4000-8000-000000000001",
	"91000000-0000-4000-8000-000000000002",
] as const;
const organizationIds = [
	"92000000-0000-4000-8000-000000000001",
	"92000000-0000-4000-8000-000000000002",
	"92000000-0000-4000-8000-000000000003",
] as const;

describe("findSoleOwnedOrganizations", () => {
	beforeEach(async () => {
		await db
			.delete(organizationTable)
			.where(inArray(organizationTable.id, organizationIds));
		await db.delete(userTable).where(inArray(userTable.id, userIds));

		await db.insert(userTable).values([
			{ id: userIds[0], name: "Owner", email: "owner-guard@example.com" },
			{
				id: userIds[1],
				name: "Other owner",
				email: "other-owner-guard@example.com",
			},
		]);
		await db.insert(organizationTable).values([
			{ id: organizationIds[0], name: "Sole-owned organization" },
			{ id: organizationIds[1], name: "Co-owned organization" },
			{ id: organizationIds[2], name: "Member-only organization" },
		]);
		await db.insert(memberTable).values([
			{
				organizationId: organizationIds[0],
				userId: userIds[0],
				role: MemberRole.owner,
			},
			{
				organizationId: organizationIds[0],
				userId: userIds[1],
				role: MemberRole.member,
			},
			{
				organizationId: organizationIds[1],
				userId: userIds[0],
				role: MemberRole.owner,
			},
			{
				organizationId: organizationIds[1],
				userId: userIds[1],
				role: MemberRole.owner,
			},
			{
				organizationId: organizationIds[2],
				userId: userIds[0],
				role: MemberRole.member,
			},
			{
				organizationId: organizationIds[2],
				userId: userIds[1],
				role: MemberRole.owner,
			},
		]);
	});

	afterAll(async () => {
		await db
			.delete(organizationTable)
			.where(inArray(organizationTable.id, organizationIds));
		await db.delete(userTable).where(inArray(userTable.id, userIds));
	});

	it("returns only organizations that have no different owner", async () => {
		await expect(findSoleOwnedOrganizations(userIds[0])).resolves.toEqual([
			{
				id: organizationIds[0],
				name: "Sole-owned organization",
			},
		]);
	});
});
