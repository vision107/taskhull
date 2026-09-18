import type { Metadata } from "next";
import type * as React from "react";
import { Suspense } from "react";

import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { Skeleton } from "@/components/ui/skeleton";
import { PrivateTasksView } from "@/components/work/private-tasks";
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
			<PageBody>
				<Suspense
					fallback={
						<div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</div>
					}
				>
					<PrivateTasksView />
				</Suspense>
			</PageBody>
		</Page>
	);
}
