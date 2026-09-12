import type { Metadata } from "next";
import type * as React from "react";

import { WorkTaskDetail } from "@/components/work/work-task-detail";

export const metadata: Metadata = {
	title: "Task",
};

export default async function WorkTaskPage({
	params,
}: {
	params: Promise<{ taskId: string }>;
}): Promise<React.JSX.Element> {
	const { taskId } = await params;
	return <WorkTaskDetail taskId={taskId} />;
}
