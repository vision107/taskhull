import { AlertCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type * as React from "react";

import { OrganizationInvitationCard } from "@/components/invitations/organization-invitation-card";
import { buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";
import { auth } from "@/lib/auth";
import {
	getInvitationPageErrorKind,
	type InvitationPageErrorKind,
} from "@/lib/auth/invitation-errors";
import { getValidInvitationId } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const metadata: Metadata = {
	title: "Organization Invitation",
};

export type OrganizationInvitationPageProps = {
	params: Promise<{ invitationId: string }>;
};

const invitationErrorContent: Record<
	Exclude<InvitationPageErrorKind, "wrong-recipient" | "unknown">,
	{ title: string; description: string }
> = {
	invalid: {
		title: "Invitation no longer valid",
		description:
			"This invitation has expired, was canceled or has already been used.",
	},
	"verification-required": {
		title: "Verify your email first",
		description:
			"Please verify your email address, then open this invitation again.",
	},
	"organization-unavailable": {
		title: "Organization unavailable",
		description: "The organization for this invitation is no longer available.",
	},
	"inviter-unavailable": {
		title: "Invitation no longer valid",
		description:
			"The person who invited you is no longer a member of this organization.",
	},
};

function InvitationErrorCard({
	kind,
	currentEmail,
}: {
	kind: Exclude<InvitationPageErrorKind, "unknown">;
	currentEmail?: string;
}): React.JSX.Element {
	const content =
		kind === "wrong-recipient"
			? {
					title: "Wrong account",
					description:
						"This invitation was sent to a different email address. Sign in with the invited address and open the link again.",
				}
			: invitationErrorContent[kind];

	return (
		<Card className="w-full border-transparent px-4 py-8 dark:border-border">
			<CardHeader>
				<div className="flex items-center gap-2">
					<AlertCircleIcon className="size-5 text-destructive" />
					<CardTitle className="text-base lg:text-lg">
						<h1>{content.title}</h1>
					</CardTitle>
				</div>
				<CardDescription>{content.description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{kind === "wrong-recipient" && currentEmail ? (
					<p className="text-sm text-muted-foreground">
						You are currently signed in as{" "}
						<span className="font-medium text-foreground">{currentEmail}</span>.
					</p>
				) : null}
				<Link
					className={buttonVariants({ className: "w-full" })}
					href="/dashboard"
				>
					Go to dashboard
				</Link>
			</CardContent>
		</Card>
	);
}

export default async function OrganizationInvitationPage({
	params,
}: OrganizationInvitationPageProps): Promise<React.JSX.Element> {
	const { invitationId } = await params;
	const validInvitationId = getValidInvitationId(invitationId);
	if (!validInvitationId) {
		return (
			<>
				<InvitationErrorCard kind="invalid" />
				<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
			</>
		);
	}
	const session = await getSession();

	let invitation: Awaited<ReturnType<typeof auth.api.getInvitation>>;
	try {
		invitation = await auth.api.getInvitation({
			query: { id: validInvitationId },
			headers: await headers(),
		});
	} catch (error) {
		const kind = getInvitationPageErrorKind(error);

		if (kind !== "unknown") {
			logger.warn(
				{ invitationId, userId: session?.user.id, kind },
				"Invitation could not be opened",
			);
			return (
				<>
					<InvitationErrorCard currentEmail={session?.user.email} kind={kind} />
					<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
				</>
			);
		}

		logger.error({ invitationId, error }, "Failed to load invitation");
		redirect("/dashboard");
	}

	const organization = await db.query.organizationTable.findFirst({
		where: (table, { eq }) => eq(table.id, invitation.organizationId),
		columns: { logo: true },
	});

	if (!organization) {
		return (
			<>
				<InvitationErrorCard kind="organization-unavailable" />
				<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
			</>
		);
	}

	return (
		<>
			<OrganizationInvitationCard
				expiresAt={new Date(invitation.expiresAt)}
				invitationId={validInvitationId}
				logoUrl={organization.logo || undefined}
				organizationName={invitation.organizationName}
			/>
			<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
		</>
	);
}
