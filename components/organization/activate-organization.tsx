"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { clearOrganizationScopedQueries } from "@/trpc/query-client";

/**
 * Sets the given organization active on the session and navigates on.
 * Rendered by `/dashboard` for users who belong to exactly one organization
 * so they never see the picker, and by the workspace layout on org deep links
 * when the session has no active organization yet. Omit `redirectTo` to stay
 * on the current URL so notification / task links survive activation.
 * Activation failures show a retry instead of bouncing back to `/dashboard`,
 * which would render this component again and loop.
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
	const [hasFailed, setHasFailed] = React.useState(false);

	const activate = React.useCallback(async () => {
		setHasFailed(false);
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
			setHasFailed(true);
		}
	}, [organizationId, redirectTo, queryClient, router]);

	React.useEffect(() => {
		if (started.current) return;
		started.current = true;
		void activate();
	}, [activate]);

	if (hasFailed) {
		return (
			<div className="mx-auto max-w-md space-y-4 p-6 pt-16 text-center">
				<p className="text-sm text-muted-foreground">
					We could not open your organization. Please try again.
				</p>
				<Button onClick={() => void activate()} type="button">
					Try again
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-md space-y-3 p-6 pt-16">
			<Skeleton className="h-6 w-40" />
			<Skeleton className="h-24 w-full rounded-xl" />
			<Skeleton className="h-24 w-full rounded-xl" />
		</div>
	);
}
