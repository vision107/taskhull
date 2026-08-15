import { createTRPCRouter } from "@/trpc/init";
import { adminNotificationRouter } from "@/trpc/routers/admin/admin-notification-router";
import { adminOrganizationRouter } from "@/trpc/routers/admin/admin-organization-router";
import { adminUserRouter } from "@/trpc/routers/admin/admin-user-router";

export const adminRouter = createTRPCRouter({
	notification: adminNotificationRouter,
	organization: adminOrganizationRouter,
	user: adminUserRouter,
});
