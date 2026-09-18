import type { Metadata } from "next";
import type * as React from "react";

import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { MyTasksView } from "@/components/work/my-tasks-view";
import { getSession } from "@/lib/auth/server";
import { getWorkDictionary, resolveWorkLocale } from "@/lib/i18n/work";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";

export async function generateMetadata(): Promise<Metadata> {
	const session = await getSession();
	const locale = resolveWorkLocale(
		(session?.user as { locale?: string | null } | undefined)?.locale,
	);
	return { title: getWorkDictionary(locale).privateList.title };
}

export default async function MyListPage(): Promise<React.JSX.Element> {
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
							{ label: t.privateList.title },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			{/* Same list + peek as assigned work; the owner can edit every field. */}
			<PageBody disableScroll className="min-h-0">
				<MyTasksView canPlan listKind="personal" />
			</PageBody>
		</Page>
	);
}
