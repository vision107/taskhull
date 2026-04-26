import type { Metadata } from "next";
import type * as React from "react";
import { TaskListView } from "@/components/projects/task-list-view";

export const metadata: Metadata = {
	title: "Task List",
};

interface ListPageProps {
	params: Promise<{ projectId: string }>;
}

export default async function ListPage({
	params,
}: ListPageProps): Promise<React.JSX.Element> {
	const { projectId } = await params;

	return <TaskListView projectId={projectId} />;
}
