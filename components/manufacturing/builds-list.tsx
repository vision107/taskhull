"use client";

import NiceModal from "@ebay/nice-modal-react";
import { FactoryIcon, PlusIcon } from "lucide-react";
import * as React from "react";

import { BuildModal } from "@/components/manufacturing/build-modal";
import { BuildsTable } from "@/components/manufacturing/builds-table";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/client";

export function BuildsList({
	canPlan,
}: {
	canPlan: boolean;
}): React.JSX.Element {
	const [includeArchived, setIncludeArchived] = React.useState(false);
	const { data, isLoading } = trpc.organization.build.list.useQuery({
		includeArchived,
	});

	const handleCreate = () => {
		void NiceModal.show(BuildModal, {});
	};

	if (isLoading) {
		return (
			<div className="flex min-h-full flex-col">
				<div className="flex h-11 items-center justify-end gap-2 border-b border-subtle px-3">
					<Skeleton className="h-7 w-28" />
					<Skeleton className="h-7 w-24" />
				</div>
				<div className="space-y-px px-3 pt-3">
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</div>
		);
	}

	if (!data || data.length === 0) {
		return (
			<div className="flex min-h-full flex-col">
				{canPlan && (
					<div className="flex h-11 shrink-0 items-center justify-end border-b border-subtle px-3">
						<Button size="sm" onClick={handleCreate}>
							<PlusIcon />
							New project
						</Button>
					</div>
				)}
				<Empty className="flex-1 py-16">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FactoryIcon />
						</EmptyMedia>
						<EmptyTitle>No projects yet</EmptyTitle>
						<EmptyDescription>
							A project is one unit you build. Start blank and add tasks, or
							copy the task plan from a template. When a project turns out well,
							save it as a template for the next one.
						</EmptyDescription>
					</EmptyHeader>
					{canPlan && (
						<EmptyContent>
							<Button onClick={handleCreate}>
								<PlusIcon />
								New project
							</Button>
						</EmptyContent>
					)}
				</Empty>
			</div>
		);
	}

	return (
		<div className="flex min-h-full flex-col">
			<div className="flex h-11 shrink-0 items-center justify-end gap-3 border-b border-subtle px-2 sm:px-3">
				<div className="mr-auto flex items-center gap-2 text-sm text-fg-secondary">
					<Switch
						id="builds-show-archived"
						checked={includeArchived}
						onCheckedChange={(checked) => setIncludeArchived(checked)}
						size="sm"
					/>
					<Label htmlFor="builds-show-archived" className="font-normal">
						Show archived
					</Label>
				</div>
				{canPlan && (
					<Button size="sm" onClick={handleCreate}>
						<PlusIcon />
						New project
					</Button>
				)}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<BuildsTable builds={data} />
			</div>
		</div>
	);
}
