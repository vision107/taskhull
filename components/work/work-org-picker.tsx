"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";
import { trpc } from "@/trpc/client";

/**
 * Shown when the session has no active organization yet (e.g. a worker who
 * was added to a team and opens the app for the first time). With a single
 * membership we pick it automatically.
 */
export function WorkOrganizationPicker(): React.JSX.Element {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: organizations, isLoading } = trpc.organization.list.useQuery();
	const [selecting, setSelecting] = React.useState<string | null>(null);
	const autoSelected = React.useRef(false);

	const select = React.useCallback(
		async (organizationId: string) => {
			setSelecting(organizationId);
			try {
				await authClient.organization.setActive({ organizationId });
				queryClient.clear();
				router.refresh();
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Could not open team",
				);
				setSelecting(null);
			}
		},
		[queryClient, router],
	);

	React.useEffect(() => {
		if (autoSelected.current) return;
		if (organizations && organizations.length === 1 && organizations[0]) {
			autoSelected.current = true;
			void select(organizations[0].id);
		}
	}, [organizations, select]);

	if (isLoading || !organizations || organizations.length === 1) {
		return (
			<div className="space-y-3 pt-6">
				<Skeleton className="h-6 w-40" />
				<Skeleton className="h-14 w-full rounded-xl" />
			</div>
		);
	}

	if (organizations.length === 0) {
		return (
			<div className="rounded-xl border bg-background px-4 py-10 text-center">
				<p className="font-medium">You're not part of a team yet</p>
				<p className="text-sm text-muted-foreground">
					Ask your planner to add you to their organization.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3 pt-4">
			<h1 className="text-lg font-semibold">Choose your team</h1>
			{organizations.map((organization) => (
				<Button
					key={organization.id}
					variant="outline"
					size="lg"
					className="w-full justify-start"
					onClick={() => select(organization.id)}
					loading={selecting === organization.id}
					disabled={selecting !== null}
				>
					{organization.name}
				</Button>
			))}
		</div>
	);
}
