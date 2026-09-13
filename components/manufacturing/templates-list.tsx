"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format } from "date-fns";
import { FileStackIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { VersionStatusBadge } from "@/components/manufacturing/status-badge";
import { TemplateModal } from "@/components/manufacturing/template-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface TemplatesListProps {
	canPlan: boolean;
}

export function TemplatesList({
	canPlan,
}: TemplatesListProps): React.JSX.Element {
	const [includeArchived, setIncludeArchived] = React.useState(false);
	const { data, isLoading } = trpc.organization.template.list.useQuery({
		includeArchived,
	});

	const handleCreate = () => {
		void NiceModal.show(TemplateModal, {});
	};

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (!data || data.length === 0) {
		return (
			<Empty className="border py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileStackIcon />
					</EmptyMedia>
					<EmptyTitle>No templates yet</EmptyTitle>
					<EmptyDescription>
						A template is the reusable task plan for one unit. The easiest way
						to get one: build a project, then save it as a template. Or start
						one here and add tasks by hand.
					</EmptyDescription>
				</EmptyHeader>
				{canPlan && (
					<EmptyContent>
						<Button onClick={handleCreate}>
							<PlusIcon />
							New template
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
						id="templates-show-archived"
						checked={includeArchived}
						onCheckedChange={(checked) => setIncludeArchived(checked)}
						size="sm"
					/>
					<Label htmlFor="templates-show-archived" className="font-normal">
						Show archived
					</Label>
				</div>
				{canPlan && (
					<Button onClick={handleCreate}>
						<PlusIcon />
						New template
					</Button>
				)}
			</div>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{data.map((template) => (
					<Link
						key={template.id}
						href={`/dashboard/organization/templates/${template.id}`}
						className="group"
					>
						<Card className="h-full transition-colors group-hover:bg-muted/40">
							<CardContent className="flex h-full flex-col gap-3 p-4">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<h3 className="truncate font-medium">{template.name}</h3>
										{template.description && (
											<p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
												{template.description}
											</p>
										)}
									</div>
									{template.archivedAt && (
										<VersionStatusBadge status="archived" />
									)}
								</div>
								<div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									{template.latestPublishedVersion ? (
										<span className="inline-flex items-center gap-1">
											<VersionStatusBadge status="published" />v
											{template.latestPublishedVersion.versionNumber}
										</span>
									) : (
										<span>Not published yet</span>
									)}
									{template.draftVersion && (
										<span className="inline-flex items-center gap-1">
											<VersionStatusBadge status="draft" />v
											{template.draftVersion.versionNumber}
										</span>
									)}
									<span className="ml-auto">
										Updated {format(template.updatedAt, "MMM d, yyyy")}
									</span>
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
