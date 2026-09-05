import { APIError } from "better-auth/api";
import { and, eq, ne, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
	ACCOUNT_DELETION_BLOCKED_CODE,
	ACCOUNT_DELETION_BLOCKED_MESSAGE,
} from "@/lib/auth/account-deletion-errors";
import { db } from "@/lib/db";
import { MemberRole } from "@/lib/db/schema/enums";
import { memberTable, organizationTable } from "@/lib/db/schema/tables";

export type SoleOwnedOrganization = {
	id: string;
	name: string;
};

export type FindSoleOwnedOrganizations = (
	userId: string,
) => Promise<SoleOwnedOrganization[]>;

export async function findSoleOwnedOrganizations(
	userId: string,
): Promise<SoleOwnedOrganization[]> {
	const otherOwner = alias(memberTable, "other_owner");

	return db
		.select({
			id: organizationTable.id,
			name: organizationTable.name,
		})
		.from(memberTable)
		.innerJoin(
			organizationTable,
			eq(organizationTable.id, memberTable.organizationId),
		)
		.where(
			and(
				eq(memberTable.userId, userId),
				eq(memberTable.role, MemberRole.owner),
				notExists(
					db
						.select({ id: otherOwner.id })
						.from(otherOwner)
						.where(
							and(
								eq(otherOwner.organizationId, memberTable.organizationId),
								eq(otherOwner.role, MemberRole.owner),
								ne(otherOwner.userId, userId),
							),
						),
				),
			),
		);
}

export async function assertAccountDeletionAllowedForUser(
	userId: string,
	findOrganizations: FindSoleOwnedOrganizations = findSoleOwnedOrganizations,
): Promise<void> {
	const organizations = await findOrganizations(userId);

	if (organizations.length > 0) {
		throw new APIError("FORBIDDEN", {
			code: ACCOUNT_DELETION_BLOCKED_CODE,
			message: ACCOUNT_DELETION_BLOCKED_MESSAGE,
		});
	}
}
