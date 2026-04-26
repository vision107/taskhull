import { redirect } from "next/navigation";
import type * as React from "react";
import { ProjectShell } from "@/components/projects/project-shell";
import { getOrganizationById, getSession } from "@/lib/auth/server";

interface ProjectLayoutProps {
	children: React.ReactNode;
	params: Promise<{ projectId: string }>;
}

export default async function ProjectLayout({
	children,
	params,
}: ProjectLayoutProps): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session?.session.activeOrganizationId) {
		redirect("/dashboard");
	}

	const organization = await getOrganizationById(
		session.session.activeOrganizationId,
	);
	if (!organization) {
		redirect("/dashboard");
	}

	const { projectId } = await params;

	return (
		<ProjectShell projectId={projectId} organization={organization}>
			{children}
		</ProjectShell>
	);
}
