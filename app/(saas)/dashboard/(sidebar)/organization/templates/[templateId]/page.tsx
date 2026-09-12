import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";

import { TemplateDetail } from "@/components/manufacturing/template-detail";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { canPlan } from "@/lib/manufacturing/permissions";

export const metadata: Metadata = {
	title: "Template",
};

export default async function TemplateDetailPage({
	params,
}: {
	params: Promise<{ templateId: string }>;
}): Promise<React.JSX.Element> {
	const { templateId } = await params;
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
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Templates", href: "/dashboard/organization/templates" },
							{ label: "Template" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<div className="p-4 pb-24 sm:px-6 sm:pt-6">
					<TemplateDetail
						templateId={templateId}
						canPlan={canPlan(membership?.role)}
					/>
				</div>
			</PageBody>
		</Page>
	);
}
