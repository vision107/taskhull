import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function getNotificationTypeLabel(type: string) {
	if (type === "success") return "Success";
	if (type === "warning") return "Warning";
	return "Information";
}

export function NotificationIcon({
	type,
	className,
}: {
	type: string;
	className?: string;
}) {
	const Icon =
		type === "success"
			? CircleCheckIcon
			: type === "warning"
				? CircleAlertIcon
				: InfoIcon;

	return (
		<Icon
			className={cn(
				"size-4",
				type === "success" && "text-emerald-600 dark:text-emerald-400",
				type === "warning" && "text-amber-600 dark:text-amber-400",
				type === "info" && "text-blue-600 dark:text-blue-400",
				className,
			)}
			aria-hidden="true"
		/>
	);
}
