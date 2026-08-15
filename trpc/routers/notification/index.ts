import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db, notificationTable } from "@/lib/db";
import {
	listNotificationsSchema,
	notificationIdSchema,
} from "@/schemas/notification-schemas";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const notificationRouter = createTRPCRouter({
	list: protectedProcedure
		.input(listNotificationsSchema)
		.query(({ ctx, input }) =>
			db
				.select({
					id: notificationTable.id,
					title: notificationTable.title,
					message: notificationTable.message,
					type: notificationTable.type,
					actionUrl: notificationTable.actionUrl,
					readAt: notificationTable.readAt,
					createdAt: notificationTable.createdAt,
				})
				.from(notificationTable)
				.where(
					and(
						eq(notificationTable.userId, ctx.user.id),
						input.status === "unread"
							? isNull(notificationTable.readAt)
							: undefined,
					),
				)
				.orderBy(desc(notificationTable.createdAt), desc(notificationTable.id))
				.limit(input.limit),
		),
	unreadCount: protectedProcedure.query(async ({ ctx }) => {
		const [row] = await db
			.select({ count: count() })
			.from(notificationTable)
			.where(
				and(
					eq(notificationTable.userId, ctx.user.id),
					isNull(notificationTable.readAt),
				),
			);
		return { count: row?.count ?? 0 };
	}),
	get: protectedProcedure
		.input(notificationIdSchema)
		.query(async ({ ctx, input }) => {
			const [notification] = await db
				.select({
					id: notificationTable.id,
					title: notificationTable.title,
					message: notificationTable.message,
					type: notificationTable.type,
					actionUrl: notificationTable.actionUrl,
					readAt: notificationTable.readAt,
					createdAt: notificationTable.createdAt,
				})
				.from(notificationTable)
				.where(
					and(
						eq(notificationTable.id, input.id),
						eq(notificationTable.userId, ctx.user.id),
					),
				)
				.limit(1);
			if (!notification) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Notification not found",
				});
			}
			return notification;
		}),
	markRead: protectedProcedure
		.input(notificationIdSchema)
		.mutation(async ({ ctx, input }) => {
			const rows = await db
				.update(notificationTable)
				.set({ readAt: new Date() })
				.where(
					and(
						eq(notificationTable.id, input.id),
						eq(notificationTable.userId, ctx.user.id),
						isNull(notificationTable.readAt),
					),
				)
				.returning({ id: notificationTable.id });
			return { count: rows.length };
		}),
	markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
		const rows = await db
			.update(notificationTable)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(notificationTable.userId, ctx.user.id),
					isNull(notificationTable.readAt),
				),
			)
			.returning({ id: notificationTable.id });
		return { count: rows.length };
	}),
});
