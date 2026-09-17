"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { clearOrganizationScopedQueries } from "@/trpc/query-client";

/**
 * Sets the given organization active on the session and navigates on.
 * Used after sign-in for a single membership, and on org deep links when
 * the session has no active organization yet. Omit `redirectTo` to stay
 * on the current URL so notification / task links survive activation.
 */
export function ActivateOrganization({
	organizationId,
	redirectTo,
}: {
	organizationId: string;
	redirectTo?: string;
}): React.JSX.Element {
	const router = useRouter();
	const queryClient = useQueryClient();
	const started = React.useRef(false);

	React.useEffect(() => {
		if (started.current) return;
		started.current = true;
		void (async () => {
			try {
				await authClient.organization.setActive({ organizationId });
				clearOrganizationScopedQueries(queryClient);
				const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
				const destination = getSafeRedirectPath(redirectTo ?? current);
				// Same-URL replace is a no-op in the App Router; refresh the
				// layout so it re-reads the session with the org now active.
				if (destination === current) {
					router.refresh();
				} else {
					router.replace(destination);
				}
			} catch {
				// Fall back to the picker so the user is never stuck here.
				router.replace("/dashboard");
			}
		})();
	}, [organizationId, redirectTo, queryClient, router]);

	return (
		<div className="mx-auto max-w-md space-y-3 p-6 pt-16">
			<Skeleton className="h-6 w-40" />
			<Skeleton className="h-24 w-full rounded-xl" />
			<Skeleton className="h-24 w-full rounded-xl" />
		</div>
	);
}
