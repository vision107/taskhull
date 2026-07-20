import Link from "next/link";
import type * as React from "react";

import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OrganizationInvitationLayout({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	return (
		<div className="font-display-headings bg-marketing-bg text-marketing-fg">
			<main className="isolate min-h-screen overflow-clip">
				<div className="mx-auto flex w-full max-w-md min-w-[320px] flex-col items-center gap-8 px-6 pt-8 pb-24 sm:pt-12 sm:pb-32">
					<Link href="/" className="inline-flex">
						<Logo className="h-10 w-auto" />
					</Link>
					<div className="w-full space-y-8">{children}</div>
				</div>
			</main>
		</div>
	);
}
