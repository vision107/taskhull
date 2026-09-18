import type { Metadata } from "next";
import type * as React from "react";

import { BuildsList } from "@/components/manufacturing/builds-list";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";

export const metadata: Metadata = {
	title: "Projects",
};

export default async function ProjectsPage(): Promise<React.JSX.Element> {
	const { organization, canPlan } = await getPlannerPageContext();

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Projects" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody disableScroll className="min-h-0">
				<BuildsList canPlan={canPlan} />
			</PageBody>
		</Page>
	);
}
