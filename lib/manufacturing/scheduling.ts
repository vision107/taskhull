import { addDays, format, parseISO } from "date-fns";

export interface SchedulableTask {
	id: string;
	durationDays: number;
	dependsOn: string[];
}

export interface ScheduledTask {
	id: string;
	startDate: string;
	endDate: string;
}

export function toDateString(date: Date): string {
	return format(date, "yyyy-MM-dd");
}

/**
 * Forward-schedule tasks from a start date. A task starts on the latest end
 * date of its dependencies (or the build start if it has none) and ends
 * `durationDays` later. Tasks without dependencies run in parallel from day 0.
 *
 * Tasks are processed in topological order; if a cycle exists, the remaining
 * tasks fall back to starting at the build start date.
 */
export function scheduleTasks(
	tasks: SchedulableTask[],
	startDate: string,
): ScheduledTask[] {
	const start = parseISO(startDate);
	const byId = new Map(tasks.map((task) => [task.id, task]));
	const endById = new Map<string, Date>();
	const result: ScheduledTask[] = [];

	const remaining = new Set(tasks.map((task) => task.id));
	let progressed = true;

	while (remaining.size > 0 && progressed) {
		progressed = false;
		for (const id of Array.from(remaining)) {
			const task = byId.get(id);
			if (!task) {
				remaining.delete(id);
				continue;
			}
			const deps = task.dependsOn.filter((dep) => byId.has(dep));
			const ready = deps.every((dep) => endById.has(dep));
			if (!ready) continue;

			let taskStart = start;
			for (const dep of deps) {
				const depEnd = endById.get(dep);
				if (depEnd && depEnd > taskStart) taskStart = depEnd;
			}
			const taskEnd = addDays(taskStart, Math.max(task.durationDays, 0));
			endById.set(id, taskEnd);
			result.push({
				id,
				startDate: toDateString(taskStart),
				endDate: toDateString(taskEnd),
			});
			remaining.delete(id);
			progressed = true;
		}
	}

	// Cycle fallback: schedule leftovers from the start date.
	for (const id of remaining) {
		const task = byId.get(id);
		const taskEnd = addDays(start, Math.max(task?.durationDays ?? 0, 0));
		endById.set(id, taskEnd);
		result.push({
			id,
			startDate: toDateString(start),
			endDate: toDateString(taskEnd),
		});
	}

	return result;
}

export function latestEndDate(scheduled: ScheduledTask[]): string | null {
	if (scheduled.length === 0) return null;
	return scheduled.reduce(
		(max, task) => (task.endDate > max ? task.endDate : max),
		scheduled[0]!.endDate,
	);
}
