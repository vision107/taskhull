"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";
import { clearOrganizationScopedQueries } from "@/trpc/query-client";

/**
 * Sets the given organization active on the session and navigates on.
 * Rendered by `/dashboard/start` for users who belong to exactly one
 * organization so they never see the picker.
 */
export function ActivateOrganization({
	organizationId,
	redirectTo,
}: {
	organizationId: string;
	redirectTo: string;
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
				router.replace(redirectTo);
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
