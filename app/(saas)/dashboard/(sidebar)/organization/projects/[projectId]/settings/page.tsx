import type { Metadata } from "next";
import type * as React from "react";
import { ProjectSettings } from "@/components/projects/project-settings";

export const metadata: Metadata = {
	title: "Project Settings",
};

interface SettingsPageProps {
	params: Promise<{ projectId: string }>;
}

export default async function ProjectSettingsPage({
	params,
}: SettingsPageProps): Promise<React.JSX.Element> {
	const { projectId } = await params;

	return <ProjectSettings projectId={projectId} />;
}
