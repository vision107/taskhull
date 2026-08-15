import { z } from "zod/v4";

import { getSafeRedirectPath } from "@/lib/auth/redirect";

export const notificationTypeSchema = z.enum(["info", "success", "warning"]);

export const notificationIdSchema = z.object({
	id: z.string().uuid(),
});

export const bulkDeleteNotificationsSchema = z.object({
	ids: z.array(z.string().uuid()).min(1).max(100),
});

export const listNotificationsSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(["all", "unread"]).default("all"),
});

export const listAdminNotificationsSchema = z.object({
	query: z.string().trim().max(200).default(""),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
	statuses: z.array(z.enum(["read", "unread"])).default([]),
	types: z.array(notificationTypeSchema).default([]),
});

export const listNotificationRecipientsSchema = z.object({
	query: z.string().trim().max(200).default(""),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createNotificationSchema = z
	.object({
		title: z.string().trim().min(1).max(120),
		message: z.string().trim().min(1).max(2000),
		type: notificationTypeSchema.default("info"),
		actionUrl: z
			.string()
			.trim()
			.max(500)
			.refine(
				(value) => value === "" || getSafeRedirectPath(value, "") === value,
				"Action URL must be an internal path",
			)
			.optional(),
		target: z.enum(["user", "all"]),
		userId: z.string().uuid().optional(),
	})
	.superRefine((value, context) => {
		if (value.target === "user" && !value.userId) {
			context.addIssue({
				code: "custom",
				path: ["userId"],
				message: "Select a recipient",
			});
		}
	});
