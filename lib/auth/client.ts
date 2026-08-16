import { passkeyClient } from "@better-auth/passkey/client";
import {
	adminClient,
	inferAdditionalFields,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
	plugins: [
		inferAdditionalFields<typeof auth>(),
		organizationClient(),
		adminClient(),
		passkeyClient(),
		twoFactorClient(),
	],
});

export type AuthClientErrorCodes = typeof authClient.$ERROR_CODES & {
	ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: string;
	ERROR_AUTHENTICATOR_GENERAL_ERROR: string;
	ERROR_CEREMONY_ABORTED: string;
	ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY: string;
	INVALID_INVITATION: string;
	PASSKEY_USER_VERIFICATION_REQUIRED: string;
	USER_BANNED: string;
};
