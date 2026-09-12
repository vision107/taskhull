"use client";

import NiceModal from "@ebay/nice-modal-react";
import { BoxIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ProductModal } from "@/components/manufacturing/product-modal";
import { VersionStatusBadge } from "@/components/manufacturing/status-badge";
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

export function ProductsList({
	canPlan,
}: {
	canPlan: boolean;
}): React.JSX.Element {
	const [includeArchived, setIncludeArchived] = React.useState(false);
	const { data, isLoading } = trpc.organization.product.list.useQuery({
		includeArchived,
	});

	const handleCreate = () => {
		void NiceModal.show(ProductModal, {});
	};

	if (isLoading) {
		return (
			<div className="space-y-3">
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
						<BoxIcon />
					</EmptyMedia>
					<EmptyTitle>No products yet</EmptyTitle>
					<EmptyDescription>
						A product is something you build again and again. Link it to a
						template, then create one build per unit.
					</EmptyDescription>
				</EmptyHeader>
				{canPlan && (
					<EmptyContent>
						<Button onClick={handleCreate}>
							<PlusIcon />
							New product
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
						id="products-show-archived"
						checked={includeArchived}
						onCheckedChange={(checked) => setIncludeArchived(checked)}
						size="sm"
					/>
					<Label htmlFor="products-show-archived" className="font-normal">
						Show archived
					</Label>
				</div>
				{canPlan && (
					<Button onClick={handleCreate}>
						<PlusIcon />
						New product
					</Button>
				)}
			</div>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{data.map((product) => (
					<Link
						key={product.id}
						href={`/dashboard/organization/products/${product.id}`}
						className="group"
					>
						<Card className="h-full transition-colors group-hover:bg-muted/40">
							<CardContent className="flex h-full flex-col gap-3 p-4">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<h3 className="truncate font-medium">{product.name}</h3>
										{product.description && (
											<p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
												{product.description}
											</p>
										)}
									</div>
									{product.archivedAt && (
										<VersionStatusBadge status="archived" />
									)}
								</div>
								<div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
									<span>
										{product.template
											? `Template: ${product.template.name}`
											: "No template"}
									</span>
									<span className="ml-auto">
										{product.openBuildCount} open · {product.buildCount} total{" "}
										{product.buildCount === 1 ? "build" : "builds"}
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
