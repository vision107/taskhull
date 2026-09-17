"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";
import { clearOrganizationScopedQueries } from "@/trpc/query-client";

/**
 * Sets the given organization active on the session and navigates on.
 * Rendered by `/dashboard` for users who belong to exactly one organization
 * so they never see the picker.
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
	const [hasFailed, setHasFailed] = React.useState(false);

	const activate = React.useCallback(async () => {
		setHasFailed(false);
		try {
			await authClient.organization.setActive({ organizationId });
			clearOrganizationScopedQueries(queryClient);
			router.replace(redirectTo);
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
