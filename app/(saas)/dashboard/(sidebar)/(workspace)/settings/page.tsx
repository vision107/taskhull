import type { Metadata } from "next";
import type * as React from "react";

import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
	PageTitle,
} from "@/components/ui/custom/page";
import { AccountSettingsTabs } from "@/components/user/account-settings-tabs";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";
import { trpc } from "@/trpc/server";

export const metadata: Metadata = {
	title: "Account",
};

export default async function AccountSettingsPage(): Promise<React.JSX.Element> {
	const [{ organization }, userAccounts] = await Promise.all([
		getPlannerPageContext(),
		trpc.user.getAccounts(),
	]);
	const userHasPassword = userAccounts?.some(
		(account) => account.providerId === "credential",
	);
	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Account Settings" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<div className="p-4 pb-24 sm:px-6 sm:pt-6">
					<div className="max-w-2xl">
						<div className="mb-2">
							<PageTitle>Account Settings</PageTitle>
						</div>
						<AccountSettingsTabs userHasPassword={userHasPassword} />
					</div>
				</div>
			</PageBody>
		</Page>
	);
}
