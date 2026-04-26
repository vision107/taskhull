import type { Metadata } from "next";
import type * as React from "react";
import { TaskBoardView } from "@/components/projects/task-board-view";

export const metadata: Metadata = {
	title: "Board",
};

interface BoardPageProps {
	params: Promise<{ projectId: string }>;
}

export default async function BoardPage({
	params,
}: BoardPageProps): Promise<React.JSX.Element> {
	const { projectId } = await params;

	return <TaskBoardView projectId={projectId} />;
}
