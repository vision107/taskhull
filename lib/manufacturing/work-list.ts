import type { BuildTaskStatus } from "@/lib/db/schema/enums";
import {
	dueIso,
	type DueChip,
	matchesDueChip,
} from "@/lib/manufacturing/format";

export const WorkListSorts = ["start", "project", "phase", "effort"] as const;
export type WorkListSort = (typeof WorkListSorts)[number];

export const WorkListSections = ["ready", "waiting", "done"] as const;
export type WorkListSection = (typeof WorkListSections)[number];

export function nextCycledStatus(status: BuildTaskStatus): BuildTaskStatus {
	if (status === "todo") return "in_progress";
	if (status === "in_progress" || status === "review") return "done";
	return "in_progress";
}

export function projectLabel(task: {
	build: {
		name: string | null;
		serialNumber: string;
		templateVersion?: { template: { name: string } } | null;
	};
}): string {
	return (
		task.build.templateVersion?.template.name ?? task.build.name ?? "Project"
	);
}

export function sortWorkTasks<
	T extends {
		title: string;
		phase: string | null;
		startDate: string | null;
		plannedHours: number | null;
		build: {
			serialNumber: string;
			name: string | null;
			templateVersion?: { template: { name: string } } | null;
		};
	},
>(tasks: T[], sort: WorkListSort): T[] {
	const copy = [...tasks];
	copy.sort((a, b) => {
		if (sort === "project") {
			return (
				projectLabel(a).localeCompare(projectLabel(b)) ||
				a.build.serialNumber.localeCompare(b.build.serialNumber) ||
				a.title.localeCompare(b.title)
			);
		}
		if (sort === "phase") {
			return (
				(a.phase ?? "").localeCompare(b.phase ?? "") ||
				a.title.localeCompare(b.title)
			);
		}
		if (sort === "effort") {
			return (
				(b.plannedHours ?? 0) - (a.plannedHours ?? 0) ||
				a.title.localeCompare(b.title)
			);
		}
		return (
			(a.startDate ?? "").localeCompare(b.startDate ?? "") ||
			a.title.localeCompare(b.title)
		);
	});
	return copy;
}

export function workSection<
	T extends { status: string; openBlockers: unknown[] },
>(task: T): WorkListSection {
	if (task.status === "done") return "done";
	if (task.openBlockers.length > 0) return "waiting";
	return "ready";
}

export function glanceFromTasks<
	T extends {
		status: string;
		openBlockers: unknown[];
		plannedHours: number | null;
		endDate?: string | Date | null;
		startDate?: string | Date | null;
	},
>(
	tasks: T[],
	today: Date = new Date(),
): { ready: number; waiting: number; hoursToday: number } {
	let ready = 0;
	let waiting = 0;
	let hoursToday = 0;
	for (const task of tasks) {
		const section = workSection(task);
		if (section === "ready") ready += 1;
		else if (section === "waiting") waiting += 1;
		if (section !== "done" && matchesDueChip(task, "today", today)) {
			hoursToday += task.plannedHours ?? 0;
		}
	}
	return { ready, waiting, hoursToday };
}

export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function filterWorkTasks<
	T extends {
		title: string;
		phase: string | null;
		status: string;
		openBlockers: unknown[];
		endDate?: string | Date | null;
		startDate?: string | Date | null;
		build: { id: string };
		parent?: { title: string } | null;
	},
>(
	tasks: T[],
	filters: {
		section?: WorkListSection | null;
		projectId?: string | null;
		phase?: string | null;
		due?: DueChip | null;
		query?: string | null;
	},
	today: Date = new Date(),
): T[] {
	const query = filters.query?.trim().toLowerCase();
	return tasks.filter((task) => {
		if (filters.section && workSection(task) !== filters.section) return false;
		if (filters.projectId && task.build.id !== filters.projectId) return false;
		if (filters.phase && task.phase !== filters.phase) return false;
		if (filters.due && !matchesDueChip(task, filters.due, today)) return false;
		if (query) {
			const haystack = `${task.title} ${task.parent?.title ?? ""} ${task.phase ?? ""}`;
			if (!haystack.toLowerCase().includes(query)) return false;
		}
		return true;
	});
}

export { dueIso };
