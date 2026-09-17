import type { Metadata } from "next";
import type * as React from "react";

import { NotificationInbox } from "@/components/notifications/notification-inbox";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";

export const metadata: Metadata = {
	title: "Inbox",
};

export default function NotificationsPage(): React.JSX.Element {
	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: "Inbox" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
					<NotificationInbox />
				</div>
			</PageBody>
		</Page>
	);
}
