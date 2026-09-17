import {
	addDays,
	format,
	isPast,
	isToday,
	type Locale,
	parseISO,
} from "date-fns";

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** "4h", "2.5h" – trims trailing zeros. */
export function formatHours(hours: number): string {
	const rounded = Math.round(hours * 100) / 100;
	return `${rounded}h`;
}

/** "2d · 4h" or just "2d" when no effort is planned. */
export function formatEffort(
	days: number,
	hours: number | null | undefined,
): string {
	return hours == null ? `${days}d` : `${days}d · ${formatHours(hours)}`;
}

function parseDate(value: string | Date): Date {
	return typeof value === "string" ? parseISO(value) : value;
}

function toIsoDate(value: string | Date): string {
	return typeof value === "string"
		? value.slice(0, 10)
		: format(value, "yyyy-MM-dd");
}

/**
 * Scheduled end dates are exclusive (start + duration). The due date people
 * read is the last working day. Zero-duration milestones keep start === end,
 * so that day is the due date.
 */
export function dueDateFromEnd(
	endDate: string | Date | null | undefined,
	startDate?: string | Date | null,
): Date | null {
	if (!endDate) return null;
	const parsed = parseDate(endDate);
	if (startDate && toIsoDate(endDate) === toIsoDate(startDate)) {
		return parsed;
	}
	return addDays(parsed, -1);
}

export function formatTaskDueLabel(
	task: {
		endDate?: string | Date | null;
		startDate?: string | Date | null;
		status: string;
	},
	options: {
		today: string;
		unscheduled: string;
		locale?: Locale;
	},
): { text: string; overdue: boolean } {
	const due =
		dueDateFromEnd(task.endDate, task.startDate) ??
		(task.startDate ? parseDate(task.startDate) : null);
	if (!due) return { text: options.unscheduled, overdue: false };
	if (isToday(due)) return { text: options.today, overdue: false };
	return {
		text: format(due, "d. MMM", { locale: options.locale }),
		overdue: isPast(due) && task.status !== "done",
	};
}

export function dueIso(
	task: {
		endDate?: string | Date | null;
		startDate?: string | Date | null;
	},
): string | null {
	const due =
		dueDateFromEnd(task.endDate, task.startDate) ??
		(task.startDate ? parseDate(task.startDate) : null);
	return due ? toIsoDate(due) : null;
}

export const DueChips = ["overdue", "today", "week", "later"] as const;
export type DueChip = (typeof DueChips)[number];

/**
 * "This week" is today through six days out so the chip does not depend on
 * locale week-start. Today is also its own chip (a subset of the week).
 */
export function matchesDueChip(
	task: {
		endDate?: string | Date | null;
		startDate?: string | Date | null;
		status: string;
	},
	chip: DueChip,
	today: Date = new Date(),
): boolean {
	const iso = dueIso(task);
	if (!iso) return false;
	const todayIso = toIsoDate(today);
	const weekEnd = toIsoDate(addDays(parseDate(todayIso), 6));
	switch (chip) {
		case "overdue":
			return iso < todayIso && task.status !== "done";
		case "today":
			return iso === todayIso;
		case "week":
			return iso >= todayIso && iso <= weekEnd;
		case "later":
			return iso > weekEnd;
	}
}

export function matchesDueRange(
	task: {
		endDate?: string | Date | null;
		startDate?: string | Date | null;
	},
	range: { dueAfter?: string; dueBefore?: string },
): boolean {
	if (!range.dueAfter && !range.dueBefore) return true;
	const iso = dueIso(task);
	if (!iso) return false;
	if (range.dueAfter && iso < range.dueAfter) return false;
	if (range.dueBefore && iso > range.dueBefore) return false;
	return true;
}
