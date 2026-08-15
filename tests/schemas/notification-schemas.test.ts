import { describe, expect, it } from "vitest";

import {
	bulkDeleteNotificationsSchema,
	createNotificationSchema,
	listAdminNotificationsSchema,
	listNotificationsSchema,
	listNotificationRecipientsSchema,
} from "@/schemas/notification-schemas";

const notification = {
	target: "user" as const,
	userId: "550e8400-e29b-41d4-a716-446655440000",
	type: "info" as const,
	title: "Account update",
	message: "Your account has been updated.",
};

describe("createNotificationSchema", () => {
	it.each(["/dashboard", "/dashboard/settings?tab=profile", "/docs#setup", ""])(
		"accepts the internal action path %s",
		(actionUrl) => {
			expect(
				createNotificationSchema.safeParse({ ...notification, actionUrl })
					.success,
			).toBe(true);
		},
	);

	it.each([
		"https://example.com",
		"//example.com",
		"/\\\\example.com",
		"javascript:alert(1)",
	])("rejects the external action path %s", (actionUrl) => {
		expect(
			createNotificationSchema.safeParse({ ...notification, actionUrl })
				.success,
		).toBe(false);
	});

	it("requires a recipient for an individual notification", () => {
		expect(
			createNotificationSchema.safeParse({ ...notification, userId: undefined })
				.success,
		).toBe(false);
	});

	it("allows a broadcast without a recipient", () => {
		expect(
			createNotificationSchema.safeParse({
				...notification,
				target: "all",
				userId: undefined,
			}).success,
		).toBe(true);
	});
});

describe("bulkDeleteNotificationsSchema", () => {
	it("accepts one or more notification IDs", () => {
		expect(
			bulkDeleteNotificationsSchema.safeParse({
				ids: ["550e8400-e29b-41d4-a716-446655440000"],
			}).success,
		).toBe(true);
	});

	it.each([{ ids: [] }, { ids: ["not-a-uuid"] }])(
		"rejects invalid notification IDs",
		({ ids }) => {
			expect(bulkDeleteNotificationsSchema.safeParse({ ids }).success).toBe(
				false,
			);
		},
	);
});

describe("listNotificationsSchema", () => {
	it("defaults to the latest notifications across all statuses", () => {
		expect(listNotificationsSchema.parse({})).toEqual({
			limit: 20,
			status: "all",
		});
	});

	it("supports an unread-only notification list", () => {
		expect(
			listNotificationsSchema.safeParse({ limit: 20, status: "unread" })
				.success,
		).toBe(true);
	});

	it("rejects unsupported notification statuses", () => {
		expect(
			listNotificationsSchema.safeParse({ status: "archived" }).success,
		).toBe(false);
	});
});

describe("listAdminNotificationsSchema", () => {
	it("applies safe pagination and filter defaults", () => {
		expect(listAdminNotificationsSchema.parse({})).toEqual({
			query: "",
			limit: 25,
			offset: 0,
			statuses: [],
			types: [],
		});
	});

	it("accepts a paginated, filtered query", () => {
		expect(
			listAdminNotificationsSchema.safeParse({
				query: "billing",
				limit: 50,
				offset: 100,
				statuses: ["unread"],
				types: ["warning"],
			}).success,
		).toBe(true);
	});

	it.each([
		{ limit: 101 },
		{ offset: -1 },
		{ statuses: ["unknown"] },
		{ types: ["unknown"] },
	])("rejects invalid list input", (input) => {
		expect(listAdminNotificationsSchema.safeParse(input).success).toBe(false);
	});
});

describe("listNotificationRecipientsSchema", () => {
	it("applies bounded search defaults", () => {
		expect(listNotificationRecipientsSchema.parse({})).toEqual({
			query: "",
			limit: 50,
		});
	});

	it.each([{ limit: 101 }, { query: "x".repeat(201) }])(
		"rejects invalid recipient search input",
		(input) => {
			expect(listNotificationRecipientsSchema.safeParse(input).success).toBe(
				false,
			);
		},
	);
});
