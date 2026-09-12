import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { recordRevision } from "@/lib/db/revision";
import {
	BuildStatus,
	RevisionAction,
	RevisionEntity,
} from "@/lib/db/schema/enums";
import {
	buildTable,
	productTable,
	templateVersionTable,
} from "@/lib/db/schema/manufacturing-tables";
import { getOwnedProduct } from "@/lib/manufacturing/builds";
import { assertCanPlan } from "@/lib/manufacturing/permissions";
import { getOwnedTemplate } from "@/lib/manufacturing/template-versions";
import {
	archiveProductSchema,
	createProductSchema,
	getProductSchema,
	listProductsSchema,
	updateProductSchema,
} from "@/schemas/manufacturing-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

export const organizationProductRouter = createTRPCRouter({
	list: protectedOrganizationProcedure
		.input(listProductsSchema)
		.query(async ({ ctx, input }) => {
			const conditions = [eq(productTable.organizationId, ctx.organization.id)];
			if (!input.includeArchived) {
				conditions.push(isNull(productTable.archivedAt));
			}

			const products = await db.query.productTable.findMany({
				where: and(...conditions),
				orderBy: asc(productTable.name),
				with: { template: { columns: { id: true, name: true } } },
			});

			if (products.length === 0) return [];

			const counts = await db
				.select({
					productId: buildTable.productId,
					total: sql<number>`count(*)::int`,
					open: sql<number>`count(*) filter (where ${buildTable.status} in ('planned','active','blocked'))::int`,
				})
				.from(buildTable)
				.where(eq(buildTable.organizationId, ctx.organization.id))
				.groupBy(buildTable.productId);
			const countByProduct = new Map(counts.map((row) => [row.productId, row]));

			return products.map((product) => ({
				...product,
				buildCount: countByProduct.get(product.id)?.total ?? 0,
				openBuildCount: countByProduct.get(product.id)?.open ?? 0,
			}));
		}),

	get: protectedOrganizationProcedure
		.input(getProductSchema)
		.query(async ({ ctx, input }) => {
			const product = await db.query.productTable.findFirst({
				where: and(
					eq(productTable.id, input.id),
					eq(productTable.organizationId, ctx.organization.id),
				),
				with: {
					template: {
						with: {
							versions: {
								orderBy: desc(templateVersionTable.versionNumber),
								columns: {
									id: true,
									versionNumber: true,
									status: true,
									publishedAt: true,
									changeNote: true,
								},
							},
						},
					},
					builds: {
						orderBy: desc(buildTable.createdAt),
						with: {
							templateVersion: {
								columns: { id: true, versionNumber: true },
							},
						},
					},
				},
			});

			if (!product) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Product not found.",
				});
			}

			return product;
		}),

	create: protectedOrganizationProcedure
		.input(createProductSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);

			if (input.templateId) {
				await getOwnedTemplate(input.templateId, ctx.organization.id);
			}

			const [product] = await db
				.insert(productTable)
				.values({
					organizationId: ctx.organization.id,
					name: input.name,
					description: input.description || null,
					templateId: input.templateId ?? null,
					createdById: ctx.user.id,
				})
				.returning();

			if (!product) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create product.",
				});
			}

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.product,
				entityId: product.id,
				action: RevisionAction.create,
				changedById: ctx.user.id,
				after: product,
			});

			return product;
		}),

	update: protectedOrganizationProcedure
		.input(updateProductSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedProduct(input.id, ctx.organization.id);

			if (input.templateId) {
				await getOwnedTemplate(input.templateId, ctx.organization.id);
			}

			const { id, ...changes } = input;
			const [after] = await db
				.update(productTable)
				.set(
					Object.fromEntries(
						Object.entries(changes).filter(([, value]) => value !== undefined),
					),
				)
				.where(eq(productTable.id, id))
				.returning();

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.product,
				entityId: id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
			});

			return after;
		}),

	archive: protectedOrganizationProcedure
		.input(archiveProductSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedProduct(input.id, ctx.organization.id);

			if (input.archived) {
				const openBuilds = await db.$count(
					buildTable,
					and(
						eq(buildTable.productId, input.id),
						sql`${buildTable.status} in (${BuildStatus.planned}, ${BuildStatus.active}, ${BuildStatus.blocked})`,
					),
				);
				if (openBuilds > 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Finish or archive the ${openBuilds} open build(s) first.`,
					});
				}
			}

			const [after] = await db
				.update(productTable)
				.set({ archivedAt: input.archived ? new Date() : null })
				.where(eq(productTable.id, input.id))
				.returning();

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.product,
				entityId: input.id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
				summary: input.archived ? "Archived" : "Unarchived",
			});

			return after;
		}),
});
