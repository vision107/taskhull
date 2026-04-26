import type { Metadata } from "next";
import type * as React from "react";
import { MobileTaskDetail } from "@/components/mobile/mobile-task-detail";

export const metadata: Metadata = {
	title: "Task Details",
};

interface TaskDetailPageProps {
	params: Promise<{ taskId: string }>;
}

export default async function TaskDetailPage({
	params,
}: TaskDetailPageProps): Promise<React.JSX.Element> {
	const { taskId } = await params;
	return <MobileTaskDetail taskId={taskId} />;
}
