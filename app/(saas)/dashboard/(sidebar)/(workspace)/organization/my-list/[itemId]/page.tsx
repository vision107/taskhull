import type { Metadata } from "next";
import type * as React from "react";

import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { PrivateItemPageView } from "@/components/work/private-item-detail";
import { getSession } from "@/lib/auth/server";
import { getWorkDictionary, resolveWorkLocale } from "@/lib/i18n/work";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";

export async function generateMetadata(): Promise<Metadata> {
	const session = await getSession();
	const locale = resolveWorkLocale(
		(session?.user as { locale?: string | null } | undefined)?.locale,
	);
	const t = getWorkDictionary(locale);
	return { title: t.privateList.itemTitle };
}

export default async function MyListItemPage({
	params,
}: {
	params: Promise<{ itemId: string }>;
}): Promise<React.JSX.Element> {
	const { itemId } = await params;
	const { organization, session } = await getPlannerPageContext();
	const t = getWorkDictionary(
		resolveWorkLocale(
			(session.user as { locale?: string | null } | undefined)?.locale,
		),
	);

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: organization.name, href: "/dashboard/organization" },
							{
								label: t.privateList.title,
								href: "/dashboard/organization/my-list",
							},
							{ label: t.privateList.itemTitle },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody disableScroll className="min-h-0">
				<PrivateItemPageView itemId={itemId} />
			</PageBody>
		</Page>
	);
}
