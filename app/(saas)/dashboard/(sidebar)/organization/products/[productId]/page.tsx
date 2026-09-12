import type { Metadata } from "next";
import type * as React from "react";

import { ProductDetail } from "@/components/manufacturing/product-detail";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";

export const metadata: Metadata = {
	title: "Product",
};

export default async function ProductDetailPage({
	params,
}: {
	params: Promise<{ productId: string }>;
}): Promise<React.JSX.Element> {
	const { productId } = await params;
	const { organization, canPlan } = await getPlannerPageContext();

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Products", href: "/dashboard/organization/products" },
							{ label: "Product" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<div className="p-4 pb-24 sm:px-6 sm:pt-6">
					<ProductDetail productId={productId} canPlan={canPlan} />
				</div>
			</PageBody>
		</Page>
	);
}
