import { eq } from "drizzle-orm";

import {
	getActiveSessions,
	getSession,
	getUserAccounts,
} from "@/lib/auth/server";
import { db } from "@/lib/db";
import { userTable } from "@/lib/db/schema";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/trpc/init";

export const userRouter = createTRPCRouter({
	getSession: publicProcedure.query(async () => await getSession()),
	getActiveSessions: protectedProcedure.query(
		async () => await getActiveSessions(),
	),
	getAccounts: protectedProcedure.query(async () => await getUserAccounts()),
	completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
		await db
			.update(userTable)
			.set({ onboardingComplete: true })
			.where(eq(userTable.id, ctx.user.id));
	}),
});
