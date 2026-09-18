import type { Metadata } from "next";
import type * as React from "react";

import { ProjectView } from "@/components/manufacturing/project-view";
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
			<PageBody disableScroll className="min-h-0">
				<ProjectView
					buildId={buildId}
					canPlan={canPlan}
					currentUserId={session.user.id}
				/>
			</PageBody>
		</Page>
	);
}
