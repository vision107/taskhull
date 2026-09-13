import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { BuildTaskStatus, MemberRole } from "@/lib/db/schema/enums";
import {
	buildTaskAssignmentTable,
	buildTaskDependencyTable,
	buildTaskTable,
} from "@/lib/db/schema/manufacturing-tables";
import { memberTable, notificationTable } from "@/lib/db/schema/tables";
import { logger } from "@/lib/logger";
import { sendPushToUsers } from "@/lib/notifications/push";

export type NotificationKind = "info" | "success" | "warning";

interface NotifyParams {
	userIds: string[];
	/** Never notify the person who caused the event. */
	actorId?: string | null;
	title: string;
	message: string;
	type?: NotificationKind;
	actionUrl?: string | null;
	/** Send a web push as well (default true). */
	push?: boolean;
}

/**
 * Write an in-app notification for each recipient and mirror it to their
 * phones via web push. Best-effort: never throws into the calling mutation.
 */
export async function notifyUsers(params: NotifyParams): Promise<number> {
	const recipients = Array.from(new Set(params.userIds)).filter(
		(id) => id !== params.actorId,
	);
	if (recipients.length === 0) return 0;

	try {
		await db.insert(notificationTable).values(
			recipients.map((userId) => ({
				userId,
				createdById: params.actorId ?? null,
				title: params.title,
				message: params.message,
				type: params.type ?? "info",
				actionUrl: params.actionUrl ?? null,
			})),
		);
	} catch (error) {
		logger.warn({ error, title: params.title }, "Failed to write notification");
		return 0;
	}

	if (params.push !== false) {
		void sendPushToUsers(recipients, {
			title: params.title,
			body: params.message,
			url: params.actionUrl ?? null,
		}).catch((error) => logger.warn({ error }, "Push fan-out failed"));
	}

	return recipients.length;
}

// ---------------------------------------------------------------------------
// Recipient helpers
// ---------------------------------------------------------------------------

/** Owners and admins of the organization — the planners. */
export async function getPlannerUserIds(
	organizationId: string,
): Promise<string[]> {
	const rows = await db.query.memberTable.findMany({
		where: and(
			eq(memberTable.organizationId, organizationId),
			inArray(memberTable.role, [MemberRole.owner, MemberRole.admin]),
		),
		columns: { userId: true },
	});
	return rows.map((row) => row.userId);
}

/** Everybody assigned to a build task, regardless of role. */
export async function getAssigneeUserIds(
	buildTaskId: string,
): Promise<string[]> {
	const rows = await db.query.buildTaskAssignmentTable.findMany({
		where: eq(buildTaskAssignmentTable.buildTaskId, buildTaskId),
		columns: { userId: true },
	});
	return rows.map((row) => row.userId);
}

export const workTaskUrl = (buildTaskId: string) =>
	`/dashboard/work/tasks/${buildTaskId}`;
export const plannerBuildUrl = (buildId: string) =>
	`/dashboard/organization/builds/${buildId}`;

// ---------------------------------------------------------------------------
// Domain events
// ---------------------------------------------------------------------------

interface TaskRef {
	id: string;
	title: string;
	buildId: string;
}

/**
 * A planner gave one worker several tasks (often the same task on 4 builds).
 * One notification, not four.
 */
export async function notifyTasksAssigned(params: {
	organizationId: string;
	actorId: string;
	assigneeId: string;
	tasks: TaskRef[];
	serialByBuildId: Map<string, string>;
}): Promise<void> {
	const { tasks } = params;
	if (tasks.length === 0) return;

	const first = tasks[0]!;
	const firstSerial = params.serialByBuildId.get(first.buildId) ?? "";
	const sameTitle = tasks.every((task) => task.title === first.title);

	const title =
		tasks.length === 1
			? "New task assigned"
			: `${tasks.length} tasks assigned to you`;
	const message =
		tasks.length === 1
			? `${first.title} · ${firstSerial}`
			: sameTitle
				? `${first.title} on ${tasks.length} builds`
				: tasks
						.slice(0, 3)
						.map((task) => task.title)
						.join(", ") + (tasks.length > 3 ? ", …" : "");

	await notifyUsers({
		userIds: [params.assigneeId],
		actorId: params.actorId,
		title,
		message,
		actionUrl: tasks.length === 1 ? workTaskUrl(first.id) : "/dashboard/work",
	});
}

/**
 * Someone commented: tell the other assignees (worker link) and the planners
 * (build link), minus the author.
 */
export async function notifyTaskCommented(params: {
	organizationId: string;
	actorId: string;
	actorName: string;
	task: TaskRef;
	serialNumber: string;
	body: string;
}): Promise<void> {
	const [assignees, planners] = await Promise.all([
		getAssigneeUserIds(params.task.id),
		getPlannerUserIds(params.organizationId),
	]);
	const excerpt =
		params.body.length > 120 ? `${params.body.slice(0, 117)}…` : params.body;
	const title = `${params.actorName} commented on ${params.task.title}`;
	const message = `${params.serialNumber} · ${excerpt}`;

	const plannerSet = new Set(planners);
	await Promise.all([
		notifyUsers({
			userIds: assignees.filter((id) => !plannerSet.has(id)),
			actorId: params.actorId,
			title,
			message,
			actionUrl: workTaskUrl(params.task.id),
		}),
		notifyUsers({
			userIds: planners,
			actorId: params.actorId,
			title,
			message,
			actionUrl: plannerBuildUrl(params.task.buildId),
		}),
	]);
}

/**
 * Status changes that planners care about (blocked, done) and the
 * "your task is ready now" nudge for dependents when a task is finished.
 */
function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function notifyTaskStatusChanged(params: {
	organizationId: string;
	actorId: string;
	actorName: string;
	task: TaskRef;
	serialNumber: string;
	from: BuildTaskStatus;
	to: BuildTaskStatus;
	reason?: string;
}): Promise<void> {
	const { task, to } = params;
	const jobs: Promise<unknown>[] = [];

	if (to === BuildTaskStatus.blocked) {
		const reason = params.reason ? ` – “${truncate(params.reason, 140)}”` : "";
		jobs.push(
			getPlannerUserIds(params.organizationId).then((planners) =>
				notifyUsers({
					userIds: planners,
					actorId: params.actorId,
					title: `Task blocked: ${task.title}`,
					message: `${params.serialNumber} · ${params.actorName}${reason}`,
					type: "warning",
					actionUrl: plannerBuildUrl(task.buildId),
				}),
			),
		);
	}

	if (to === BuildTaskStatus.done) {
		jobs.push(
			getPlannerUserIds(params.organizationId).then((planners) =>
				notifyUsers({
					userIds: planners,
					actorId: params.actorId,
					title: `Task finished: ${task.title}`,
					message: `${params.serialNumber} · by ${params.actorName}`,
					type: "success",
					actionUrl: plannerBuildUrl(task.buildId),
					// Planners get plenty of these; keep them in-app only.
					push: false,
				}),
			),
		);
		jobs.push(notifyDependentsReady(params));
	}

	await Promise.all(jobs);
}

/**
 * When a task is finished, tasks that depended on it may now be ready. Tell
 * their assignees — but only if *all* of their blockers are done.
 */
async function notifyDependentsReady(params: {
	actorId: string;
	task: TaskRef;
	serialNumber: string;
}): Promise<void> {
	const dependents = await db.query.buildTaskDependencyTable.findMany({
		where: eq(buildTaskDependencyTable.dependsOnBuildTaskId, params.task.id),
		columns: { buildTaskId: true },
	});
	if (dependents.length === 0) return;

	const dependentIds = dependents.map((dep) => dep.buildTaskId);
	const [dependentTasks, allBlockers] = await Promise.all([
		db.query.buildTaskTable.findMany({
			where: inArray(buildTaskTable.id, dependentIds),
			columns: { id: true, title: true, status: true },
			with: { assignments: { columns: { userId: true } } },
		}),
		db.query.buildTaskDependencyTable.findMany({
			where: inArray(buildTaskDependencyTable.buildTaskId, dependentIds),
			with: { dependsOn: { columns: { id: true, status: true } } },
		}),
	]);

	const openBlockersByTask = new Map<string, number>();
	for (const dep of allBlockers) {
		if (dep.dependsOn.status !== BuildTaskStatus.done) {
			openBlockersByTask.set(
				dep.buildTaskId,
				(openBlockersByTask.get(dep.buildTaskId) ?? 0) + 1,
			);
		}
	}

	await Promise.all(
		dependentTasks
			.filter(
				(dependent) =>
					dependent.status === BuildTaskStatus.todo &&
					(openBlockersByTask.get(dependent.id) ?? 0) === 0 &&
					dependent.assignments.length > 0,
			)
			.map((dependent) =>
				notifyUsers({
					userIds: dependent.assignments.map((a) => a.userId),
					actorId: params.actorId,
					title: `Ready to start: ${dependent.title}`,
					message: `${params.serialNumber} · "${params.task.title}" is finished`,
					type: "success",
					actionUrl: workTaskUrl(dependent.id),
				}),
			),
	);
}
