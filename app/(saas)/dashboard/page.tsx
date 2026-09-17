import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type * as React from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";
import { ActivateOrganization } from "@/components/organization/activate-organization";
import { OrganizationsGrid } from "@/components/organization/organizations-grid";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";
import { appConfig } from "@/config/app.config";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { memberTable } from "@/lib/db/schema/tables";
import { canPlan } from "@/lib/manufacturing/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Choose an organization",
};

function getLandingPath(role: string): string {
	return canPlan(role) ? "/dashboard/organization" : "/dashboard/work";
}

/**
 * Entry point of the app. There is no personal area: every signed-in user
 * works inside an organization, so this page only decides which one.
 *
 * - Active organization on the session → planner dashboard or worker task list.
 * - Worker everywhere → task list (it picks the organization itself).
 * - Exactly one organization → activate it and continue.
 * - Otherwise (several organizations, none active, or none at all) → picker.
 */
export default async function DashboardPage(): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session) {
		redirect("/auth/sign-in?redirectTo=%2Fdashboard");
	}

	const memberships = await db.query.memberTable.findMany({
		where: eq(memberTable.userId, session.user.id),
		columns: { organizationId: true, role: true },
	});

	const activeId = session.session.activeOrganizationId ?? null;
	const activeMembership = activeId
		? memberships.find((m) => m.organizationId === activeId)
		: undefined;
	if (activeMembership) {
		redirect(getLandingPath(activeMembership.role));
	}

	const planning = memberships.filter((m) => canPlan(m.role));
	if (memberships.length > 0 && planning.length === 0) {
		redirect("/dashboard/work");
	}

	const onlyMembership = memberships.length === 1 ? memberships[0] : undefined;
	if (onlyMembership) {
		return (
			<ActivateOrganization
				organizationId={onlyMembership.organizationId}
				redirectTo={getLandingPath(onlyMembership.role)}
			/>
		);
	}

	const hasOrganizations = memberships.length > 0;

	return (
		<main className="min-h-screen bg-neutral-50 px-4 dark:bg-background">
			<div className="mx-auto w-full max-w-5xl py-12">
				<Link className="mx-auto mb-6 block w-fit" href="/">
					<Logo />
				</Link>

				<div className="mb-8 flex flex-col items-center text-center">
					<h1 className="text-2xl font-bold lg:text-3xl">
						{hasOrganizations
							? "Choose an organization"
							: `Welcome to ${appConfig.appName}`}
					</h1>
					<p className="mt-2 text-sm text-muted-foreground lg:text-base">
						{hasOrganizations
							? "Pick the organization you want to work in. You can switch at any time from the sidebar."
							: "You are not a member of any organization yet."}
					</p>
				</div>

				<OrganizationsGrid />

				<p className="mt-10 text-center text-sm text-muted-foreground">
					Signed in as{" "}
					<span className="font-medium text-foreground">
						{session.user.email}
					</span>
					. <SignOutButton />
				</p>
			</div>
			<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
		</main>
	);
}
