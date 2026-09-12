"use client";

import NiceModal from "@ebay/nice-modal-react";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { AssignmentGrid } from "@/components/manufacturing/assignment-grid";
import { BuildModal } from "@/components/manufacturing/build-modal";
import { BuildsTable } from "@/components/manufacturing/builds-table";
import { ProductModal } from "@/components/manufacturing/product-modal";
import { VersionStatusBadge } from "@/components/manufacturing/status-badge";
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
import { trpc } from "@/trpc/client";

export function ProductDetail({
	productId,
	canPlan,
}: {
	productId: string;
	canPlan: boolean;
}): React.JSX.Element {
	const utils = trpc.useUtils();
	const [tab, setTab] = React.useState("builds");
	const { data: product, isLoading } = trpc.organization.product.get.useQuery({
		id: productId,
	});
	const { data: builds } = trpc.organization.build.list.useQuery({
		productId,
		includeArchived: true,
	});

	const archiveMutation = trpc.organization.product.archive.useMutation({
		onSuccess: (_, input) => {
			toast.success(input.archived ? "Product archived" : "Product restored");
			void utils.organization.product.get.invalidate({ id: productId });
			void utils.organization.product.list.invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	if (isLoading || !product) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	const latestPublished = product.template?.versions.find(
		(version) => version.status === "published",
	);
	const canCreateBuild =
		canPlan &&
		!product.archivedAt &&
		(!product.template || Boolean(latestPublished));

	const handleNewBuild = () => {
		void NiceModal.show(BuildModal, { productId });
	};

	const handleArchiveToggle = () => {
		const archived = !product.archivedAt;
		void NiceModal.show(ConfirmationModal, {
			title: archived ? "Archive product?" : "Restore product?",
			message: archived
				? "Archived products are hidden and can't get new builds. All builds must be finished or archived first."
				: "The product becomes visible again.",
			confirmLabel: archived ? "Archive" : "Restore",
			destructive: archived,
			onConfirm: async () => {
				await archiveMutation.mutateAsync({ id: productId, archived });
			},
		});
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<PageTitle className="truncate">{product.name}</PageTitle>
						{product.archivedAt && <VersionStatusBadge status="archived" />}
					</div>
					{product.description && (
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							{product.description}
						</p>
					)}
					<p className="mt-1 text-xs text-muted-foreground">
						{product.template ? (
							<>
								Template:{" "}
								<Link
									href={`/dashboard/organization/templates/${product.template.id}`}
									className="underline-offset-2 hover:underline"
								>
									{product.template.name}
								</Link>
								{latestPublished
									? ` · latest published v${latestPublished.versionNumber}`
									: " · no published version yet"}
							</>
						) : (
							"No template linked — builds start empty."
						)}
					</p>
				</div>
				{canPlan && (
					<div className="flex items-center gap-2">
						<Button onClick={handleNewBuild} disabled={!canCreateBuild}>
							<PlusIcon />
							New build
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" aria-label="More">
									<MoreHorizontalIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() =>
										NiceModal.show(ProductModal, {
											product: {
												id: product.id,
												name: product.name,
												description: product.description,
												templateId: product.templateId,
											},
										})
									}
								>
									<PencilIcon />
									Edit product
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant={product.archivedAt ? "default" : "destructive"}
									onClick={handleArchiveToggle}
								>
									{product.archivedAt ? (
										<ArchiveRestoreIcon />
									) : (
										<ArchiveIcon />
									)}
									{product.archivedAt ? "Restore" : "Archive"}
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
					<UnderlinedTabsTrigger value="builds">
						Builds{builds ? ` (${builds.length})` : ""}
					</UnderlinedTabsTrigger>
					<UnderlinedTabsTrigger value="assignments">
						Assignments across builds
					</UnderlinedTabsTrigger>
				</UnderlinedTabsList>

				<UnderlinedTabsContent value="builds">
					{!builds ? (
						<Skeleton className="h-40 w-full" />
					) : builds.length === 0 ? (
						<Empty className="border py-12">
							<EmptyHeader>
								<EmptyTitle>No builds for this product</EmptyTitle>
								<EmptyDescription>
									Each unit you manufacture is one build with its own serial
									number and task list.
								</EmptyDescription>
							</EmptyHeader>
							{canCreateBuild && (
								<EmptyContent>
									<Button onClick={handleNewBuild}>
										<PlusIcon />
										New build
									</Button>
								</EmptyContent>
							)}
						</Empty>
					) : (
						<BuildsTable builds={builds} showProduct={false} />
					)}
				</UnderlinedTabsContent>

				<UnderlinedTabsContent value="assignments">
					<AssignmentGrid productId={productId} canPlan={canPlan} />
				</UnderlinedTabsContent>
			</UnderlinedTabs>
		</div>
	);
}
