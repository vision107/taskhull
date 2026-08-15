import { TRPCError } from "@trpc/server";
import {
	and,
	count,
	desc,
	eq,
	ilike,
	inArray,
	isNotNull,
	isNull,
	or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db, notificationTable, userTable } from "@/lib/db";
import {
	bulkDeleteNotificationsSchema,
	createNotificationSchema,
	listAdminNotificationsSchema,
	listNotificationRecipientsSchema,
} from "@/schemas/notification-schemas";
import { createTRPCRouter, protectedAdminProcedure } from "@/trpc/init";

const BROADCAST_BATCH_SIZE = 500;
const activeUserCondition = or(
	eq(userTable.banned, false),
	isNull(userTable.banned),
);

export const adminNotificationRouter = createTRPCRouter({
	list: protectedAdminProcedure
		.input(listAdminNotificationsSchema)
		.query(async ({ input }) => {
			const creatorTable = alias(userTable, "notification_creator");
			const query = `%${input.query}%`;
			const typeCondition = input.types.length
				? inArray(notificationTable.type, input.types)
				: undefined;
			const statusCondition =
				input.statuses.length === 1
					? input.statuses[0] === "read"
						? isNotNull(notificationTable.readAt)
						: isNull(notificationTable.readAt)
					: undefined;
			const searchCondition = input.query
				? or(
						ilike(notificationTable.title, query),
						ilike(notificationTable.message, query),
						ilike(userTable.name, query),
						ilike(userTable.email, query),
						ilike(creatorTable.name, query),
						ilike(creatorTable.email, query),
					)
				: undefined;
			const where = and(statusCondition, typeCondition, searchCondition);
			const baseQuery = db
				.select({
					id: notificationTable.id,
					title: notificationTable.title,
					message: notificationTable.message,
					type: notificationTable.type,
					actionUrl: notificationTable.actionUrl,
					readAt: notificationTable.readAt,
					createdAt: notificationTable.createdAt,
					user: {
						name: userTable.name,
						email: userTable.email,
					},
					createdBy: {
						name: creatorTable.name,
						email: creatorTable.email,
					},
				})
				.from(notificationTable)
				.innerJoin(userTable, eq(notificationTable.userId, userTable.id))
				.leftJoin(
					creatorTable,
					eq(notificationTable.createdById, creatorTable.id),
				)
				.where(where)
				.orderBy(desc(notificationTable.createdAt), desc(notificationTable.id))
				.limit(input.limit)
				.offset(input.offset);
			const countQuery = db
				.select({ total: count() })
				.from(notificationTable)
				.innerJoin(userTable, eq(notificationTable.userId, userTable.id))
				.leftJoin(
					creatorTable,
					eq(notificationTable.createdById, creatorTable.id),
				)
				.where(where);
			const [notifications, [totalRow]] = await Promise.all([
				baseQuery,
				countQuery,
			]);

			return { notifications, total: totalRow?.total ?? 0 };
		}),
	recipients: protectedAdminProcedure
		.input(listNotificationRecipientsSchema)
		.query(async ({ input }) => {
			const searchCondition = input.query
				? or(
						ilike(userTable.name, `%${input.query}%`),
						ilike(userTable.email, `%${input.query}%`),
					)
				: undefined;
			const [users, [totalRow]] = await Promise.all([
				db
					.select({
						id: userTable.id,
						name: userTable.name,
						email: userTable.email,
					})
					.from(userTable)
					.where(and(activeUserCondition, searchCondition))
					.orderBy(userTable.name, userTable.email, userTable.id)
					.limit(input.limit),
				db
					.select({ total: count() })
					.from(userTable)
					.where(activeUserCondition),
			]);

			return { users, total: totalRow?.total ?? 0 };
		}),
	create: protectedAdminProcedure
		.input(createNotificationSchema)
		.mutation(async ({ ctx, input }) => {
			const actionUrl = input.actionUrl || null;
			if (input.target === "user") {
				const [recipient] = await db
					.select({ id: userTable.id })
					.from(userTable)
					.where(and(eq(userTable.id, input.userId ?? ""), activeUserCondition))
					.limit(1);
				if (!recipient) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Recipient not found",
					});
				}
				await db.insert(notificationTable).values({
					userId: recipient.id,
					createdById: ctx.user.id,
					title: input.title,
					message: input.message,
					type: input.type,
					actionUrl,
				});
				return { count: 1 };
			}

			const count = await db.transaction(async (transaction) => {
				const users = await transaction
					.select({ id: userTable.id })
					.from(userTable)
					.where(activeUserCondition);
				if (users.length === 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "There are no active users to notify",
					});
				}
				for (
					let offset = 0;
					offset < users.length;
					offset += BROADCAST_BATCH_SIZE
				) {
					const batch = users.slice(offset, offset + BROADCAST_BATCH_SIZE);
					await transaction.insert(notificationTable).values(
						batch.map((user) => ({
							userId: user.id,
							createdById: ctx.user.id,
							title: input.title,
							message: input.message,
							type: input.type,
							actionUrl,
						})),
					);
				}
				return users.length;
			});
			return { count };
		}),
	bulkDelete: protectedAdminProcedure
		.input(bulkDeleteNotificationsSchema)
		.mutation(async ({ input }) => {
			const deleted = await db
				.delete(notificationTable)
				.where(inArray(notificationTable.id, input.ids))
				.returning({ id: notificationTable.id });

			return { count: deleted.length };
		}),
});
