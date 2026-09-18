"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { authConfig } from "@/config/auth.config";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { authClient } from "@/lib/auth/client";

/**
 * Signs the user out and wipes every client-side cache so no data from the
 * previous user survives a switch of accounts on the same device.
 */
export function useSignOut(): () => Promise<void> {
	const queryClient = useQueryClient();
	const router = useProgressRouter();

	return React.useCallback(async () => {
		try {
			await authClient.signOut();
		} finally {
			queryClient.clear();

			// Preserve device-level preferences
			const theme = localStorage.getItem("theme");
			const cookieConsent = localStorage.getItem("cookie_consent");

			localStorage.clear();
			sessionStorage.clear();

			if (theme) localStorage.setItem("theme", theme);
			if (cookieConsent) localStorage.setItem("cookie_consent", cookieConsent);

			router.refresh();
			window.location.href = new URL(
				authConfig.redirectAfterLogout,
				window.location.origin,
			).toString();
		}
	}, [queryClient, router]);
}
