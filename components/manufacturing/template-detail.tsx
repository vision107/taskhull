"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format } from "date-fns";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	GitBranchPlusIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { AssignmentGrid } from "@/components/manufacturing/assignment-grid";
import { BuildModal } from "@/components/manufacturing/build-modal";
import { BuildsTable } from "@/components/manufacturing/builds-table";
import { VersionStatusBadge } from "@/components/manufacturing/status-badge";
import { TemplateModal } from "@/components/manufacturing/template-modal";
import { TemplateVersionEditor } from "@/components/manufacturing/template-version-editor";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/custom/page";
import {
	UnderlinedTabs,
	UnderlinedTabsContent,
	UnderlinedTabsList,
	UnderlinedTabsTrigger,
} from "@/components/ui/custom/underlined-tabs";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
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
	const [tab, setTab] = React.useState("plan");
	const { data: projects } = trpc.organization.build.list.useQuery({
		templateId,
		includeArchived: true,
	});

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

	const canCreateProject =
		canPlan && !template.archivedAt && Boolean(latestPublished);
	const handleNewProject = () => {
		void NiceModal.show(BuildModal, { templateId });
	};

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
					<p className="mt-1 text-xs text-muted-foreground">
						{latestPublished
							? `Latest published v${latestPublished.versionNumber}`
							: "No published version yet"}
						{projects && projects.length > 0
							? ` · ${projects.length} ${projects.length === 1 ? "project" : "projects"}`
							: ""}
					</p>
				</div>
				{canPlan && (
					<div className="flex items-center gap-2">
						<Button onClick={handleNewProject} disabled={!canCreateProject}>
							<PlusIcon />
							New project
						</Button>
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

			<UnderlinedTabs
				value={tab}
				onValueChange={(value) => setTab(String(value))}
			>
				<UnderlinedTabsList className="mb-4 sm:-ml-4">
					<UnderlinedTabsTrigger value="plan">Task plan</UnderlinedTabsTrigger>
					<UnderlinedTabsTrigger value="projects">
						Projects{projects ? ` (${projects.length})` : ""}
					</UnderlinedTabsTrigger>
					<UnderlinedTabsTrigger value="assignments">
						Assignments across projects
					</UnderlinedTabsTrigger>
				</UnderlinedTabsList>

				<UnderlinedTabsContent value="plan" className="space-y-6">
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
										{version.taskCount}{" "}
										{version.taskCount === 1 ? "task" : "tasks"}
										{version.status === "published" && version.publishedAt && (
											<> · {format(version.publishedAt, "MMM d, yyyy")}</>
										)}
										{version.buildCount > 0 && (
											<>
												{" "}
												· {version.buildCount}{" "}
												{version.buildCount === 1 ? "project" : "projects"}
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
				</UnderlinedTabsContent>

				<UnderlinedTabsContent value="projects">
					{!projects ? (
						<Skeleton className="h-40 w-full" />
					) : projects.length === 0 ? (
						<Empty className="border py-12">
							<EmptyHeader>
								<EmptyTitle>No projects from this template</EmptyTitle>
								<EmptyDescription>
									Each unit you build is one project with its own serial number
									and task list.
								</EmptyDescription>
							</EmptyHeader>
							{canCreateProject && (
								<EmptyContent>
									<Button onClick={handleNewProject}>
										<PlusIcon />
										New project
									</Button>
								</EmptyContent>
							)}
						</Empty>
					) : (
						<BuildsTable builds={projects} showTemplate={false} />
					)}
				</UnderlinedTabsContent>

				<UnderlinedTabsContent value="assignments">
					<AssignmentGrid templateId={templateId} canPlan={canPlan} />
				</UnderlinedTabsContent>
			</UnderlinedTabs>
		</div>
	);
}
