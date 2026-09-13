import { and, eq, gt, isNull, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import {
	buildTaskTable,
	templateTaskTable,
} from "@/lib/db/schema/manufacturing-tables";

type TaskTable = typeof buildTaskTable | typeof templateTaskTable;

/**
 * Sort position for a new task so it lands right after the last task with
 * the same phase (the lists group contiguous phases). Tasks behind that
 * position are shifted by one. Without a phase, or when the phase has no
 * tasks yet, the task is appended.
 */
export async function nextSortOrderForPhase(
	table: TaskTable,
	scope: SQL,
	phase: string | null,
): Promise<number> {
	const phaseFilter =
		phase === null ? isNull(table.phase) : eq(table.phase, phase);
	const [phaseRow] = await db
		.select({ maxSort: sql<number | null>`max(${table.sortOrder})::int` })
		.from(table)
		.where(and(scope, phaseFilter));
	const lastInPhase = phaseRow?.maxSort ?? null;

	if (lastInPhase === null) {
		const [row] = await db
			.select({
				maxSort: sql<number>`coalesce(max(${table.sortOrder}), -1)::int`,
			})
			.from(table)
			.where(scope);
		return (row?.maxSort ?? -1) + 1;
	}

	await db
		.update(table)
		.set({ sortOrder: sql`${table.sortOrder} + 1` })
		.where(and(scope, gt(table.sortOrder, lastInPhase)));
	return lastInPhase + 1;
}
