"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format } from "date-fns";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	GitBranchPlusIcon,
	MoreHorizontalIcon,
	PencilIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { VersionStatusBadge } from "@/components/manufacturing/status-badge";
import { TemplateModal } from "@/components/manufacturing/template-modal";
import { TemplateVersionEditor } from "@/components/manufacturing/template-version-editor";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/custom/page";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface TemplateDetailProps {
	templateId: string;
	canPlan: boolean;
}

export function TemplateDetail({
	templateId,
	canPlan,
}: TemplateDetailProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const { data: template, isLoading } = trpc.organization.template.get.useQuery(
		{
			id: templateId,
		},
	);
	const [selectedVersionId, setSelectedVersionId] = React.useState<
		string | null
	>(null);

	const versions = template?.versions ?? [];
	const draft = versions.find((version) => version.status === "draft");
	const latestPublished = versions.find(
		(version) => version.status === "published",
	);

	// Default to the draft (if any), else the latest published, else the first.
	const activeVersionId =
		selectedVersionId && versions.some((v) => v.id === selectedVersionId)
			? selectedVersionId
			: ((draft ?? latestPublished ?? versions[0])?.id ?? null);
	const activeVersion = versions.find((v) => v.id === activeVersionId);

	const ensureDraftMutation =
		trpc.organization.template.ensureDraft.useMutation({
			onSuccess: (created) => {
				toast.success(`Draft v${created.versionNumber} created`);
				void utils.organization.template.get.invalidate({ id: templateId });
				void utils.organization.template.list.invalidate();
				setSelectedVersionId(created.id);
			},
			onError: (error) => toast.error(error.message),
		});

	const archiveMutation = trpc.organization.template.archive.useMutation({
		onSuccess: (_, input) => {
			toast.success(input.archived ? "Template archived" : "Template restored");
			void utils.organization.template.get.invalidate({ id: templateId });
			void utils.organization.template.list.invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	if (isLoading || !template) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-10 w-96" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	const handleArchiveToggle = () => {
		const archived = !template.archivedAt;
		void NiceModal.show(ConfirmationModal, {
			title: archived ? "Archive template?" : "Restore template?",
			message: archived
				? "Archived templates are hidden from the list and cannot be used for new builds. Existing builds are not affected."
				: "The template will be visible again and usable for new builds.",
			confirmLabel: archived ? "Archive" : "Restore",
			destructive: archived,
			onConfirm: async () => {
				await archiveMutation.mutateAsync({ id: templateId, archived });
			},
		});
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<PageTitle className="truncate">{template.name}</PageTitle>
						{template.archivedAt && <VersionStatusBadge status="archived" />}
					</div>
					{template.description && (
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							{template.description}
						</p>
					)}
					{template.products.length > 0 && (
						<p className="mt-1 text-xs text-muted-foreground">
							Used by{" "}
							{template.products.map((product) => product.name).join(", ")}
						</p>
					)}
				</div>
				{canPlan && (
					<div className="flex items-center gap-2">
						{!draft && !template.archivedAt && (
							<Button
								variant="outline"
								onClick={() => ensureDraftMutation.mutate({ templateId })}
								loading={ensureDraftMutation.isPending}
								disabled={ensureDraftMutation.isPending}
							>
								<GitBranchPlusIcon />
								New draft
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" aria-label="More">
									<MoreHorizontalIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() =>
										NiceModal.show(TemplateModal, {
											template: {
												id: template.id,
												name: template.name,
												description: template.description,
											},
										})
									}
								>
									<PencilIcon />
									Edit name & description
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant={template.archivedAt ? "default" : "destructive"}
									onClick={handleArchiveToggle}
								>
									{template.archivedAt ? (
										<ArchiveRestoreIcon />
									) : (
										<ArchiveIcon />
									)}
									{template.archivedAt ? "Restore" : "Archive"}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
			</div>

			{/* Version strip */}
			<div className="flex flex-wrap gap-2">
				{versions.map((version) => {
					const isActive = version.id === activeVersionId;
					return (
						<button
							key={version.id}
							type="button"
							onClick={() => setSelectedVersionId(version.id)}
							className={cn(
								"flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
								isActive
									? "border-foreground/40 bg-muted"
									: "border-border hover:bg-muted/50",
							)}
						>
							<span className="flex items-center gap-2 font-medium">
								v{version.versionNumber}
								<VersionStatusBadge status={version.status} />
							</span>
							<span className="text-xs text-muted-foreground">
								{version.taskCount} {version.taskCount === 1 ? "task" : "tasks"}
								{version.status === "published" && version.publishedAt && (
									<> · {format(version.publishedAt, "MMM d, yyyy")}</>
								)}
								{version.buildCount > 0 && (
									<>
										{" "}
										· {version.buildCount}{" "}
										{version.buildCount === 1 ? "build" : "builds"}
									</>
								)}
							</span>
						</button>
					);
				})}
			</div>

			{activeVersion && (
				<TemplateVersionEditor
					key={activeVersion.id}
					templateId={templateId}
					versionId={activeVersion.id}
					canPlan={canPlan && !template.archivedAt}
					hasOtherVersions={versions.length > 1}
				/>
			)}
		</div>
	);
}
