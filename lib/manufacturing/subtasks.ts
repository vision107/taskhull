import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
	buildTaskTable,
	templateTaskTable,
} from "@/lib/db/schema/manufacturing-tables";

interface SubtaskParent {
	id: string;
	phase: string | null;
	startDate: string | null;
}

/**
 * Resolve the parent for a new subtask and enforce the rules: it must live in
 * the same container (version / project) and must itself be top level, so
 * nesting stays one deep.
 */
export async function getSubtaskParent(
	table: typeof templateTaskTable,
	parentTaskId: string,
	scope: { versionId: string },
): Promise<SubtaskParent>;
export async function getSubtaskParent(
	table: typeof buildTaskTable,
	parentTaskId: string,
	scope: { buildId: string },
): Promise<SubtaskParent>;
export async function getSubtaskParent(
	table: typeof templateTaskTable | typeof buildTaskTable,
	parentTaskId: string,
	scope: { versionId?: string; buildId?: string },
): Promise<SubtaskParent> {
	const parent =
		table === templateTaskTable
			? await db.query.templateTaskTable
					.findFirst({
						where: and(
							eq(templateTaskTable.id, parentTaskId),
							eq(templateTaskTable.versionId, scope.versionId ?? ""),
						),
						columns: { id: true, phase: true, parentTaskId: true },
					})
					.then((row) => row && { ...row, startDate: null })
			: await db.query.buildTaskTable.findFirst({
					where: and(
						eq(buildTaskTable.id, parentTaskId),
						eq(buildTaskTable.buildId, scope.buildId ?? ""),
					),
					columns: {
						id: true,
						phase: true,
						parentTaskId: true,
						startDate: true,
					},
				});

	if (!parent) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Parent task not found.",
		});
	}
	if (parent.parentTaskId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Subtasks cannot have subtasks of their own.",
		});
	}
	return { id: parent.id, phase: parent.phase, startDate: parent.startDate };
}
