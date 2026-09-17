import type { Metadata } from "next";
import type * as React from "react";

import { BuildDetail } from "@/components/manufacturing/build-detail";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";

export const metadata: Metadata = {
	title: "Project",
};

export default async function ProjectDetailPage({
	params,
}: {
	params: Promise<{ buildId: string }>;
}): Promise<React.JSX.Element> {
	const { buildId } = await params;
	const { organization, canPlan, session } = await getPlannerPageContext();

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Projects", href: "/dashboard/organization/projects" },
							{ label: "Project" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<div className="p-4 pb-24 sm:px-6 sm:pt-6">
					<BuildDetail
						buildId={buildId}
						canPlan={canPlan}
						currentUserId={session.user.id}
					/>
				</div>
			</PageBody>
		</Page>
	);
}
