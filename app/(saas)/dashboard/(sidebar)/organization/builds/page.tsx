import type { Metadata } from "next";
import type * as React from "react";

import { BuildsList } from "@/components/manufacturing/builds-list";
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
	title: "Builds",
};

export default async function BuildsPage(): Promise<React.JSX.Element> {
	const { organization, canPlan } = await getPlannerPageContext();

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Builds" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="Builds">
					<BuildsList canPlan={canPlan} />
				</PageContent>
			</PageBody>
		</Page>
	);
}
