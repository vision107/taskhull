import { db } from "@/lib/db/client";
import { buildTaskActivityTable } from "@/lib/db/schema/manufacturing-tables";
import { logger } from "@/lib/logger";

export const ActivityAction = {
	buildCreated: "build.created",
	buildUpdated: "build.updated",
	buildStatusChanged: "build.status_changed",
	buildUpgraded: "build.upgraded",
	taskCreated: "task.created",
	taskUpdated: "task.updated",
	taskStatusChanged: "task.status_changed",
	taskAssigned: "task.assigned",
	taskUnassigned: "task.unassigned",
	taskCommented: "task.commented",
	taskAttachmentAdded: "task.attachment_added",
	taskChecklistUpdated: "task.checklist_updated",
} as const;
export type ActivityAction =
	(typeof ActivityAction)[keyof typeof ActivityAction];

interface LogActivityParams {
	organizationId: string;
	buildId?: string | null;
	buildTaskId?: string | null;
	actorId?: string | null;
	action: ActivityAction;
	metadata?: Record<string, unknown>;
}

/**
 * Append a human-readable activity entry for a build/task. Best-effort.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
	try {
		await db.insert(buildTaskActivityTable).values({
			organizationId: params.organizationId,
			buildId: params.buildId ?? null,
			buildTaskId: params.buildTaskId ?? null,
			actorId: params.actorId ?? null,
			action: params.action,
			metadata: params.metadata ?? {},
		});
	} catch (error) {
		logger.warn({ error, action: params.action }, "Failed to log activity");
	}
}

/**
 * Bulk variant for operations that touch many tasks at once (e.g. assigning
 * the same task across several builds).
 */
export async function logActivities(
	entries: LogActivityParams[],
): Promise<void> {
	if (entries.length === 0) return;
	try {
		await db.insert(buildTaskActivityTable).values(
			entries.map((params) => ({
				organizationId: params.organizationId,
				buildId: params.buildId ?? null,
				buildTaskId: params.buildTaskId ?? null,
				actorId: params.actorId ?? null,
				action: params.action,
				metadata: params.metadata ?? {},
			})),
		);
	} catch (error) {
		logger.warn({ error, count: entries.length }, "Failed to log activities");
	}
}
