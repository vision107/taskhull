import type { Metadata } from "next";
import type * as React from "react";
import { GanttView } from "@/components/projects/gantt-view";

export const metadata: Metadata = {
	title: "Gantt Chart",
};

interface GanttPageProps {
	params: Promise<{ projectId: string }>;
}

export default async function GanttPage({
	params,
}: GanttPageProps): Promise<React.JSX.Element> {
	const { projectId } = await params;

	return <GanttView projectId={projectId} />;
}
