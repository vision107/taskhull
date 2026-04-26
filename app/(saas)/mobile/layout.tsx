import { redirect } from "next/navigation";
import type * as React from "react";
import { MobileProviders } from "@/app/(saas)/mobile/providers";
import { getSession } from "@/lib/auth/server";

export default async function MobileLayout({
	children,
}: React.PropsWithChildren): Promise<React.JSX.Element> {
	const session = await getSession();

	if (!session) {
		redirect("/auth/sign-in");
	}

	return (
		<MobileProviders session={session}>
			<div className="flex h-dvh flex-col overflow-hidden bg-background">
				{/* Safe area top */}
				<div className="safe-area-top" />
				<main className="flex flex-1 flex-col overflow-hidden">{children}</main>
				{/* Safe area bottom */}
				<div className="safe-area-bottom" />
			</div>
		</MobileProviders>
	);
}
