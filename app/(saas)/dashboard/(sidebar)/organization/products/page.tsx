import type { Metadata } from "next";
import type * as React from "react";

import { ProductsList } from "@/components/manufacturing/products-list";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageContent,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";

export const metadata: Metadata = {
	title: "Products",
};

export default async function ProductsPage(): Promise<React.JSX.Element> {
	const { organization, canPlan } = await getPlannerPageContext();

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Products" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="Products">
					<ProductsList canPlan={canPlan} />
				</PageContent>
			</PageBody>
		</Page>
	);
}
