import { Badge } from "@/components/ui/badge";
import type {
	BuildStatus,
	BuildTaskStatus,
	TemplateVersionStatus,
} from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";

const versionStyles: Record<TemplateVersionStatus, string> = {
	draft: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
	published:
		"bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
	archived: "bg-muted text-muted-foreground",
};

const versionLabels: Record<TemplateVersionStatus, string> = {
	draft: "Draft",
	published: "Published",
	archived: "Archived",
};

export function VersionStatusBadge({
	status,
	className,
}: {
	status: TemplateVersionStatus;
	className?: string;
}): React.JSX.Element {
	return (
		<Badge
			variant="secondary"
			className={cn("border-0", versionStyles[status], className)}
		>
			{versionLabels[status]}
		</Badge>
	);
}

const buildStyles: Record<BuildStatus, string> = {
	planned: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
	active:
		"bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
	blocked: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
	completed:
		"bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
	archived: "bg-muted text-muted-foreground",
};

const buildLabels: Record<BuildStatus, string> = {
	planned: "Planned",
	active: "Active",
	blocked: "Blocked",
	completed: "Completed",
	archived: "Archived",
};

export function BuildStatusBadge({
	status,
	className,
}: {
	status: BuildStatus;
	className?: string;
}): React.JSX.Element {
	return (
		<Badge
			variant="secondary"
			className={cn("border-0", buildStyles[status], className)}
		>
			{buildLabels[status]}
		</Badge>
	);
}

export const taskStatusStyles: Record<BuildTaskStatus, string> = {
	todo: "bg-muted text-muted-foreground",
	in_progress:
		"bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
	blocked: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
	review:
		"bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
	done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
};

/** Solid colours for compact status dots and gantt bars. */
export const taskStatusDot: Record<BuildTaskStatus, string> = {
	todo: "bg-neutral-400 dark:bg-neutral-500",
	in_progress: "bg-indigo-500",
	blocked: "bg-red-500",
	review: "bg-amber-500",
	done: "bg-emerald-500",
};

export const taskStatusLabels: Record<BuildTaskStatus, string> = {
	todo: "To do",
	in_progress: "In progress",
	blocked: "Blocked",
	review: "Review",
	done: "Done",
};

export function TaskStatusBadge({
	status,
	className,
}: {
	status: BuildTaskStatus;
	className?: string;
}): React.JSX.Element {
	return (
		<Badge
			variant="secondary"
			className={cn("border-0", taskStatusStyles[status], className)}
		>
			{taskStatusLabels[status]}
		</Badge>
	);
}
