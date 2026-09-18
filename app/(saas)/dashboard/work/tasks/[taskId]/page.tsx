import { redirect } from "next/navigation";

/** Legacy worker task URL (still present in old notifications and bookmarks). */
export default async function WorkTaskPage({
	params,
}: {
	params: Promise<{ taskId: string }>;
}): Promise<never> {
	const { taskId } = await params;
	redirect(`/dashboard/organization/tasks/${taskId}`);
}
