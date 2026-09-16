import type { Metadata } from "next";
import type * as React from "react";

import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { MyTasksList } from "@/components/work/my-tasks-list";
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
							{ label: t.list.title },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
					<MyTasksList />
				</div>
			</PageBody>
		</Page>
	);
}
