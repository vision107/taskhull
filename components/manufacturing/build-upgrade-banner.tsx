"use client";

import NiceModal from "@ebay/nice-modal-react";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowUpCircleIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/app";

type Upgrade =
	inferRouterOutputs<AppRouter>["organization"]["build"]["get"]["availableUpgrades"][number];

/**
 * Shown on a build when its template has a newer published version. Applies
 * the newest one; older intermediate versions are skipped on purpose (the
 * newest always contains their changes).
 */
export function BuildUpgradeBanner({
	buildId,
	currentVersionNumber,
	upgrades,
}: {
	buildId: string;
	currentVersionNumber: number | null;
	upgrades: Upgrade[];
}): React.JSX.Element | null {
	const utils = trpc.useUtils();
	const upgradeMutation = trpc.organization.build.upgradeToVersion.useMutation({
		onSuccess: (result) => {
			const parts = [
				result.added > 0 && `${result.added} added`,
				result.updated > 0 && `${result.updated} updated`,
				result.removed > 0 && `${result.removed} removed`,
				result.kept > 0 && `${result.kept} kept as ad-hoc`,
			].filter(Boolean);
			toast.success(
				`Upgraded to v${result.toVersionNumber}`,
				parts.length > 0 ? { description: parts.join(" · ") } : undefined,
			);
			void utils.organization.build.get.invalidate({ id: buildId });
			void utils.organization.build.list.invalidate();
			void utils.organization.work.activity.invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	const newest = upgrades[0];
	if (!newest) return null;

	const handleUpgrade = () => {
		void NiceModal.show(ConfirmationModal, {
			title: `Upgrade to template v${newest.versionNumber}?`,
			message:
				"Tasks that still exist keep their status, assignees, comments and photos. New tasks are added unassigned, removed tasks are deleted only if nobody has touched them, and open tasks are rescheduled.",
			confirmLabel: "Upgrade build",
			onConfirm: async () => {
				await upgradeMutation.mutateAsync({
					buildId,
					templateVersionId: newest.id,
				});
			},
		});
	};

	return (
		<div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
			<ArrowUpCircleIcon className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
			<div className="min-w-0 flex-1">
				<p className="font-medium">
					Template v{newest.versionNumber} is available
					{currentVersionNumber !== null && (
						<span className="font-normal text-muted-foreground">
							{" "}
							(this build runs v{currentVersionNumber})
						</span>
					)}
				</p>
				{newest.changeNote && (
					<p className="truncate text-muted-foreground">{newest.changeNote}</p>
				)}
			</div>
			<Button
				size="sm"
				onClick={handleUpgrade}
				loading={upgradeMutation.isPending}
			>
				Upgrade build
			</Button>
		</div>
	);
}
