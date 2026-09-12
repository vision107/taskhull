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
	title: "Build",
};

export default async function BuildDetailPage({
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
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Builds", href: "/dashboard/organization/builds" },
							{ label: "Build" },
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
