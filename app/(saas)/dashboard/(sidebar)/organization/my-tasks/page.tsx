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
	return { title: getWorkDictionary(locale).list.title };
}

export default async function MyTasksPage(): Promise<React.JSX.Element> {
	const { organization, session, canPlan } = await getPlannerPageContext();
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
							{ label: t.list.title },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			{/* The view owns its scroll regions: list on the left, task peek on the right. */}
			<PageBody disableScroll className="min-h-0">
				<MyTasksView canPlan={canPlan} />
			</PageBody>
		</Page>
	);
}
