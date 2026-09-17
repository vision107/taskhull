import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { privateTaskTable } from "@/lib/db/schema/manufacturing-tables";
import { getOwnedBuildTask } from "@/lib/manufacturing/builds";
import {
	createPrivateTaskSchema,
	deletePrivateTaskSchema,
	listPrivateTasksSchema,
	updatePrivateTaskSchema,
} from "@/schemas/manufacturing-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

/**
 * Every query is scoped to the caller inside the active organization; nobody
 * else (not even an owner) can read another member's private list.
 */
function ownedBy(organizationId: string, userId: string) {
	return and(
		eq(privateTaskTable.organizationId, organizationId),
		eq(privateTaskTable.userId, userId),
	);
}

async function getOwnedPrivateTask(
	id: string,
	organizationId: string,
	userId: string,
) {
	const task = await db.query.privateTaskTable.findFirst({
		where: and(eq(privateTaskTable.id, id), ownedBy(organizationId, userId)),
	});

	if (!task) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Note not found." });
	}

	return task;
}

/**
 * A linked project task must belong to the same organization. Returns the
 * value to store (`null` clears the link).
 */
async function resolveBuildTaskLink(
	buildTaskId: string | null | undefined,
	organizationId: string,
): Promise<string | null | undefined> {
	if (buildTaskId === undefined) return undefined;
	if (buildTaskId === null) return null;
	const task = await getOwnedBuildTask(buildTaskId, organizationId);
	return task.id;
}

const linkedTaskColumns = {
	columns: { id: true, title: true, status: true },
	with: {
		build: { columns: { id: true, serialNumber: true, name: true } },
	},
} as const;

export const organizationPrivateTaskRouter = createTRPCRouter({
	/**
	 * The caller's private list: open items first (due soonest on top, then
	 * oldest first), finished ones only when asked for.
	 */
	list: protectedOrganizationProcedure
		.input(listPrivateTasksSchema)
		.query(async ({ ctx, input }) => {
			const scope = ownedBy(ctx.organization.id, ctx.user.id);
			return db.query.privateTaskTable.findMany({
				where: input.includeDone
					? scope
					: and(scope, isNull(privateTaskTable.completedAt)),
				orderBy: [
					sql`${privateTaskTable.completedAt} IS NOT NULL`,
					sql`${privateTaskTable.dueDate} ASC NULLS LAST`,
					asc(privateTaskTable.createdAt),
				],
				with: { buildTask: linkedTaskColumns },
			});
		}),

	create: protectedOrganizationProcedure
		.input(createPrivateTaskSchema)
		.mutation(async ({ ctx, input }) => {
			const buildTaskId = await resolveBuildTaskLink(
				input.buildTaskId,
				ctx.organization.id,
			);

			const [created] = await db
				.insert(privateTaskTable)
				.values({
					organizationId: ctx.organization.id,
					userId: ctx.user.id,
					title: input.title,
					notes: input.notes || null,
					dueDate: input.dueDate ?? null,
					buildTaskId: buildTaskId ?? null,
				})
				.returning();

			if (!created) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create note.",
				});
			}

			return created;
		}),

	update: protectedOrganizationProcedure
		.input(updatePrivateTaskSchema)
		.mutation(async ({ ctx, input }) => {
			const before = await getOwnedPrivateTask(
				input.id,
				ctx.organization.id,
				ctx.user.id,
			);
			const buildTaskId = await resolveBuildTaskLink(
				input.buildTaskId,
				ctx.organization.id,
			);

			const completedAt =
				input.done === undefined
					? before.completedAt
					: input.done
						? (before.completedAt ?? new Date())
						: null;

			const [after] = await db
				.update(privateTaskTable)
				.set({
					title: input.title ?? before.title,
					notes: input.notes === undefined ? before.notes : input.notes || null,
					dueDate: input.dueDate === undefined ? before.dueDate : input.dueDate,
					buildTaskId:
						buildTaskId === undefined ? before.buildTaskId : buildTaskId,
					completedAt,
				})
				.where(eq(privateTaskTable.id, before.id))
				.returning();

			if (!after) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update note.",
				});
			}

			return after;
		}),

	delete: protectedOrganizationProcedure
		.input(deletePrivateTaskSchema)
		.mutation(async ({ ctx, input }) => {
			const task = await getOwnedPrivateTask(
				input.id,
				ctx.organization.id,
				ctx.user.id,
			);
			await db.delete(privateTaskTable).where(eq(privateTaskTable.id, task.id));
			return { success: true };
		}),
});
