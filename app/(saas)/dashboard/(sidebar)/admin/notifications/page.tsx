import type { Metadata } from "next";

import { AdminNotifications } from "@/components/admin/notifications/admin-notifications";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageContent,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";

export const metadata: Metadata = { title: "Notifications" };

export default function AdminNotificationsPage() {
	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Admin", href: "/dashboard/admin" },
							{ label: "Notifications" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="Notifications">
					<AdminNotifications />
				</PageContent>
			</PageBody>
		</Page>
	);
}
