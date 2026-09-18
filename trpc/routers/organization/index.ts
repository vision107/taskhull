import slugify from "@sindresorhus/slugify";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, getTableColumns } from "drizzle-orm";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { z } from "zod/v4";

import { appConfig } from "@/config/app.config";
import { auth } from "@/lib/auth";
import { canManageOrganizationMembers } from "@/lib/auth/organization-permissions";
import { assertUserIsOrgMember } from "@/lib/auth/server";
import { db, memberTable, organizationTable } from "@/lib/db";
import { creditBalanceTable, InvitationStatus } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import {
	createOrganizationSchema,
	getOrganizationByIdSchema,
} from "@/schemas/organization-schemas";
import {
	createTRPCRouter,
	protectedOrganizationProcedure,
	protectedProcedure,
} from "@/trpc/init";
import { organizationBuildRouter } from "@/trpc/routers/organization/organization-build-router";
import { organizationCreditRouter } from "@/trpc/routers/organization/organization-credit-router";
import { organizationProductRouter } from "@/trpc/routers/organization/organization-product-router";
import { organizationSubscriptionRouter } from "@/trpc/routers/organization/organization-subscription-router";
import { organizationTemplateRouter } from "@/trpc/routers/organization/organization-template-router";
import { organizationWorkRouter } from "@/trpc/routers/organization/organization-work-router";

async function generateOrganizationSlug(name: string): Promise<string> {
	const baseSlug = slugify(name, {
		lowercase: true,
	});

	let slug = baseSlug;
	let hasAvailableSlug = false;

	for (let i = 0; i < 3; i++) {
		slug = `${baseSlug}-${nanoid(5)}`;

		const existing = await db.query.organizationTable.findFirst({
			where: (org, { eq }) => eq(org.slug, slug),
		});

		if (!existing) {
			hasAvailableSlug = true;
			break;
		}
	}

	if (!hasAvailableSlug) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No available slug found",
		});
	}

	return slug;
}

export const organizationRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const organizations = await db
			.select({
				...getTableColumns(organizationTable),
				membersCount: db
					.$count(
						memberTable,
						eq(memberTable.organizationId, organizationTable.id),
					)
					.as("membersCount"),
			})
			.from(organizationTable)
			.innerJoin(
				memberTable,
				eq(organizationTable.id, memberTable.organizationId),
			)
			.where(eq(memberTable.userId, ctx.user.id))
			.orderBy(asc(organizationTable.createdAt));

		return organizations.map((org) => ({
			...org,
			slug: org.slug || "",
		}));
	}),
	get: protectedProcedure
		.input(getOrganizationByIdSchema)
		.query(async ({ ctx, input }) => {
			// Verify user is a member of this organization (throws if not)
			const { organization } = await assertUserIsOrgMember(
				input.id,
				ctx.user.id,
			);

			return organization;
		}),
	create: protectedProcedure
		.input(createOrganizationSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if organization creation is allowed for non-admin users
			if (
				!appConfig.organizations.allowUserCreation &&
				ctx.user.role !== "admin"
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Organization creation is disabled. Contact an administrator.",
				});
			}

			const organization = await auth.api.createOrganization({
				headers: await headers(),
				body: {
					name: input.name,
					slug: await generateOrganizationSlug(input.name), // Slug is kept for internal reference but not used in URLs
					metadata: input.metadata,
				},
			});

			if (!organization) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create organization",
				});
			}

			// Initialize credit balance for the new organization
			// This ensures the organization has a balance record from creation
			// rather than relying on lazy initialization
			try {
				await db
					.insert(creditBalanceTable)
					.values({ organizationId: organization.id })
					.onConflictDoNothing();
			} catch (error) {
				// Log but don't fail org creation - balance will be created lazily if needed
				logger.warn(
					{ organizationId: organization.id, error },
					"Failed to initialize credit balance for new organization",
				);
			}

			return organization;
		}),
	revokeInvitation: protectedOrganizationProcedure
		.input(z.object({ invitationId: z.uuid() }))
		.mutation(async ({ ctx, input }) => {
			if (!canManageOrganizationMembers(ctx.membership.role)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have permission to revoke invitations.",
				});
			}

			const invitation = await db.query.invitationTable.findFirst({
				where: (table) =>
					and(
						eq(table.id, input.invitationId),
						eq(table.organizationId, ctx.organization.id),
						eq(table.status, InvitationStatus.pending),
					),
				columns: { id: true },
			});

			if (!invitation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "This pending invitation no longer exists.",
				});
			}

			await auth.api.cancelInvitation({
				headers: await headers(),
				body: { invitationId: invitation.id },
			});

			return { success: true };
		}),

	// Context-specific sub-routers
	credit: organizationCreditRouter,
	subscription: organizationSubscriptionRouter,

	// Manufacturing
	template: organizationTemplateRouter,
	product: organizationProductRouter,
	build: organizationBuildRouter,
	work: organizationWorkRouter,
});
