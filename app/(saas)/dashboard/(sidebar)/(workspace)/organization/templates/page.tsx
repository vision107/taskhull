import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";

import { TemplatesList } from "@/components/manufacturing/templates-list";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageContent,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { canPlan } from "@/lib/manufacturing/permissions";

export const metadata: Metadata = {
	title: "Templates",
};

export default async function TemplatesPage(): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session?.session.activeOrganizationId) {
		redirect("/dashboard");
	}

	const organization = await getOrganizationById(
		session.session.activeOrganizationId,
	);
	if (!organization) {
		redirect("/dashboard");
	}

	const membership = organization.members.find(
		(member) => member.userId === session.user.id,
	);

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Templates" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="Templates">
					<TemplatesList canPlan={canPlan(membership?.role)} />
				</PageContent>
			</PageBody>
		</Page>
	);
}
