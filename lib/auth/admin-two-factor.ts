import { TRPCError } from "@trpc/server";

export type TwoFactorResetTarget = {
	id: string;
	role: string;
	twoFactorEnabled: boolean | null;
};

export function assertAdminCanResetTwoFactor({
	actorUserId,
	isImpersonating,
	targetUser,
}: {
	actorUserId: string;
	isImpersonating: boolean;
	targetUser: TwoFactorResetTarget;
}): void {
	if (isImpersonating) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Stop impersonating before changing two-factor authentication.",
		});
	}

	if (targetUser.id === actorUserId || targetUser.role === "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Two-factor authentication for administrator accounts cannot be disabled here.",
		});
	}

	if (!targetUser.twoFactorEnabled) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Two-factor authentication is not enabled for this user.",
		});
	}
}
