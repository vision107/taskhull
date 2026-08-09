import { TRPCError } from "@trpc/server";

import { storageConfig } from "@/config/storage.config";
import { canUploadOrganizationLogo } from "@/lib/auth/organization-permissions";
import { getSignedUploadUrl } from "@/lib/storage";
import {
	createTRPCRouter,
	protectedOrganizationProcedure,
	protectedProcedure,
} from "@/trpc/init";

export const storageRouter = createTRPCRouter({
	userAvatarUploadUrl: protectedProcedure.mutation(async ({ ctx }) => {
		const path = `${ctx.user.id}-${crypto.randomUUID()}.png`;
		const signedUrl = await getSignedUploadUrl(
			path,
			storageConfig.bucketNames.images,
		);
		return { path, signedUrl };
	}),
	organizationLogoUploadUrl: protectedOrganizationProcedure.mutation(
		async ({ ctx }) => {
			if (!canUploadOrganizationLogo(ctx.membership.role)) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			const path = `logo-${ctx.organization.id}-${crypto.randomUUID()}.png`;
			const signedUrl = await getSignedUploadUrl(
				path,
				storageConfig.bucketNames.images,
			);
			return { path, signedUrl };
		},
	),
});
