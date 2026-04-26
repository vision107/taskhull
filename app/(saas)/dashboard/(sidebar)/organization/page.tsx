import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";
import { MyTasksView } from "@/components/my-tasks/my-tasks-view";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getOrganizationById, getSession } from "@/lib/auth/server";

export const metadata: Metadata = {
	title: "My Tasks",
};

export default async function OrganizationHomePage(): Promise<React.JSX.Element> {
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

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "My Tasks" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<MyTasksView />
			</PageBody>
		</Page>
	);
}
