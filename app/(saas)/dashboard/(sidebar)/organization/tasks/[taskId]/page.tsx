import type { Metadata } from "next";
import type * as React from "react";

import { TaskPlannerView } from "@/components/manufacturing/task-detail-sheet";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { WorkTaskDetail } from "@/components/work/work-task-detail";
import { getWorkDictionary, resolveWorkLocale } from "@/lib/i18n/work";
import { getPlannerPageContext } from "@/lib/manufacturing/page-context";

export const metadata: Metadata = {
	title: "Task",
};

/**
 * Full-page task view, shared by planners and workers. The same URL works
 * from a notification tap on a phone and from a project on a desktop.
 */
export default async function TaskPage({
	params,
}: {
	params: Promise<{ taskId: string }>;
}): Promise<React.JSX.Element> {
	const { taskId } = await params;
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
							{
								label: t.list.title,
								href: "/dashboard/organization/my-tasks",
							},
							{ label: t.detail.taskTitle },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			{/* The detail owns its scroll region so the action bar can sit below it. */}
			<PageBody disableScroll className="min-h-0">
				{canPlan ? (
					<TaskPlannerView taskId={taskId} canPlan variant="page" />
				) : (
					<WorkTaskDetail taskId={taskId} />
				)}
			</PageBody>
		</Page>
	);
}
