"use client";

import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth/client";

export const passkeysQueryKey = ["user", "passkeys"] as const;

export async function listUserPasskeys() {
	const { data, error } = await authClient.passkey.listUserPasskeys();

	if (error) {
		throw error;
	}

	return data ?? [];
}

export function usePasskeys() {
	return useQuery({
		queryKey: passkeysQueryKey,
		queryFn: listUserPasskeys,
	});
}
