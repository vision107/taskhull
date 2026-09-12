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
		return <Skeleton className="h-48 w-full" />;
	}

	if (!data || data.length === 0) {
		return (
			<Empty className="border py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FactoryIcon />
					</EmptyMedia>
					<EmptyTitle>No builds yet</EmptyTitle>
					<EmptyDescription>
						A build is one unit of a product. Creating one copies the tasks from
						the product's template version and schedules them.
					</EmptyDescription>
				</EmptyHeader>
				{canPlan && (
					<EmptyContent>
						<Button onClick={handleCreate}>
							<PlusIcon />
							New build
						</Button>
					</EmptyContent>
				)}
			</Empty>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
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
					<Button onClick={handleCreate}>
						<PlusIcon />
						New build
					</Button>
				)}
			</div>
			<BuildsTable builds={data} />
		</div>
	);
}
