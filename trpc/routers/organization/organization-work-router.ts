import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import { storageConfig } from "@/config/storage.config";
import { db } from "@/lib/db";
import { recordRevision } from "@/lib/db/revision";
import {
	BuildStatus,
	BuildTaskStatus,
	ChecklistItemStatus,
	RevisionAction,
	RevisionEntity,
} from "@/lib/db/schema/enums";
import {
	buildTaskActivityTable,
	buildTaskAssignmentTable,
	buildTaskAttachmentTable,
	buildTaskChecklistItemTable,
	buildTaskCommentTable,
	buildTaskTable,
} from "@/lib/db/schema/manufacturing-tables";
import { ActivityAction, logActivity } from "@/lib/manufacturing/activity";
import {
	getOpenBlockers,
	getOwnedBuild,
	getOwnedBuildTask,
	syncBuildStatus,
} from "@/lib/manufacturing/builds";
import {
	notifyTaskCommented,
	notifyTaskStatusChanged,
} from "@/lib/manufacturing/notifications";
import { canPlan } from "@/lib/manufacturing/permissions";
import { getSignedUploadUrl, getSignedUrl } from "@/lib/storage";
import {
	addBuildTaskAttachmentSchema,
	addBuildTaskCommentSchema,
	attachmentDownloadUrlSchema,
	buildTaskAttachmentUploadUrlSchema,
	deleteBuildTaskAttachmentSchema,
	deleteBuildTaskCommentSchema,
	getBuildTaskSchema,
	listBuildTaskActivitySchema,
	listMyTasksSchema,
	updateBuildTaskChecklistItemSchema,
	updateBuildTaskStatusSchema,
} from "@/schemas/manufacturing-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

function sanitizeFileName(fileName: string): string {
	return fileName.replace(/[^a-zA-Z0-9\-_.]/g, "_").slice(0, 120);
}

/**
 * Workers may act on tasks they are assigned to; planners may act on any task
 * in the organization.
 */
async function assertCanWorkOn(
	buildTaskId: string,
	userId: string,
	role: string,
): Promise<void> {
	if (canPlan(role)) return;

	const assignment = await db.query.buildTaskAssignmentTable.findFirst({
		where: and(
			eq(buildTaskAssignmentTable.buildTaskId, buildTaskId),
			eq(buildTaskAssignmentTable.userId, userId),
		),
		columns: { id: true },
	});

	if (!assignment) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not assigned to this task.",
		});
	}
}

const ALLOWED_TRANSITIONS: Record<BuildTaskStatus, BuildTaskStatus[]> = {
	[BuildTaskStatus.todo]: [BuildTaskStatus.inProgress, BuildTaskStatus.blocked],
	[BuildTaskStatus.inProgress]: [
		BuildTaskStatus.todo,
		BuildTaskStatus.blocked,
		BuildTaskStatus.review,
		BuildTaskStatus.done,
	],
	[BuildTaskStatus.blocked]: [BuildTaskStatus.todo, BuildTaskStatus.inProgress],
	[BuildTaskStatus.review]: [BuildTaskStatus.inProgress, BuildTaskStatus.done],
	[BuildTaskStatus.done]: [BuildTaskStatus.inProgress],
};

export const organizationWorkRouter = createTRPCRouter({
	/**
	 * The worker's todo list: every task they are assigned to on an open build,
	 * labeled with product and serial number. Planners see the same shape for
	 * themselves.
	 */
	myTasks: protectedOrganizationProcedure
		.input(listMyTasksSchema)
		.query(async ({ ctx, input }) => {
			const assignments = await db.query.buildTaskAssignmentTable.findMany({
				where: eq(buildTaskAssignmentTable.userId, ctx.user.id),
				columns: { buildTaskId: true, role: true },
			});
			if (assignments.length === 0) return [];

			const roleByTask = new Map(
				assignments.map((assignment) => [
					assignment.buildTaskId,
					assignment.role,
				]),
			);

			const conditions = [
				eq(buildTaskTable.organizationId, ctx.organization.id),
				inArray(
					buildTaskTable.id,
					assignments.map((assignment) => assignment.buildTaskId),
				),
			];
			if (input.status && input.status.length > 0) {
				conditions.push(inArray(buildTaskTable.status, input.status));
			} else if (!input.includeDone) {
				conditions.push(ne(buildTaskTable.status, BuildTaskStatus.done));
			}

			const tasks = await db.query.buildTaskTable.findMany({
				where: and(...conditions),
				orderBy: [
					asc(buildTaskTable.startDate),
					asc(buildTaskTable.sortOrder),
					asc(buildTaskTable.createdAt),
				],
				with: {
					build: {
						columns: {
							id: true,
							serialNumber: true,
							name: true,
							status: true,
						},
						with: { product: { columns: { id: true, name: true } } },
					},
					checklistItems: { columns: { id: true, status: true } },
					dependencies: {
						with: {
							dependsOn: { columns: { id: true, title: true, status: true } },
						},
					},
					attachments: { columns: { id: true } },
					comments: { columns: { id: true } },
				},
			});

			return tasks
				.filter((task) => task.build.status !== BuildStatus.archived)
				.map((task) => ({
					id: task.id,
					title: task.title,
					phase: task.phase,
					status: task.status,
					startDate: task.startDate,
					endDate: task.endDate,
					requiresPhoto: task.requiresPhoto,
					requiresComment: task.requiresComment,
					myRole: roleByTask.get(task.id) ?? null,
					build: task.build,
					checklistTotal: task.checklistItems.length,
					checklistDone: task.checklistItems.filter(
						(item) => item.status !== ChecklistItemStatus.open,
					).length,
					openBlockers: task.dependencies
						.map((dep) => dep.dependsOn)
						.filter((dep) => dep.status !== BuildTaskStatus.done),
					attachmentCount: task.attachments.length,
					commentCount: task.comments.length,
				}));
		}),

	getTask: protectedOrganizationProcedure
		.input(getBuildTaskSchema)
		.query(async ({ ctx, input }) => {
			const task = await db.query.buildTaskTable.findFirst({
				where: and(
					eq(buildTaskTable.id, input.id),
					eq(buildTaskTable.organizationId, ctx.organization.id),
				),
				with: {
					build: {
						columns: {
							id: true,
							serialNumber: true,
							name: true,
							status: true,
							plannedStartDate: true,
						},
						with: { product: { columns: { id: true, name: true } } },
					},
					assignments: {
						with: { user: { columns: { id: true, name: true, image: true } } },
					},
					checklistItems: {
						orderBy: asc(buildTaskChecklistItemTable.sortOrder),
						with: { completedBy: { columns: { id: true, name: true } } },
					},
					comments: {
						orderBy: asc(buildTaskCommentTable.createdAt),
						with: {
							author: { columns: { id: true, name: true, image: true } },
						},
					},
					attachments: {
						orderBy: asc(buildTaskAttachmentTable.createdAt),
						with: { uploadedBy: { columns: { id: true, name: true } } },
					},
					dependencies: {
						with: {
							dependsOn: { columns: { id: true, title: true, status: true } },
						},
					},
					dependents: {
						with: {
							buildTask: { columns: { id: true, title: true, status: true } },
						},
					},
				},
			});

			if (!task) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
			}

			const isAssigned = task.assignments.some(
				(assignment) => assignment.userId === ctx.user.id,
			);

			return {
				...task,
				isAssigned,
				canEdit: isAssigned || canPlan(ctx.membership.role),
				documents: task.attachments.filter(
					(attachment) => attachment.templateDocumentId !== null,
				),
				uploads: task.attachments.filter(
					(attachment) => attachment.templateDocumentId === null,
				),
				blockers: task.dependencies
					.map((dep) => dep.dependsOn)
					.filter((dep) => dep.status !== BuildTaskStatus.done),
			};
		}),

	updateStatus: protectedOrganizationProcedure
		.input(updateBuildTaskStatusSchema)
		.mutation(async ({ ctx, input }) => {
			const before = await getOwnedBuildTask(input.id, ctx.organization.id);
			await assertCanWorkOn(before.id, ctx.user.id, ctx.membership.role);

			if (before.status === input.status) return before;

			const allowed = ALLOWED_TRANSITIONS[before.status] ?? [];
			if (!allowed.includes(input.status) && !canPlan(ctx.membership.role)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cannot move a task from ${before.status} to ${input.status}.`,
				});
			}

			if (input.status === BuildTaskStatus.done) {
				const blockers = await getOpenBlockers(before.id);
				if (blockers.length > 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Finish "${blockers[0]!.title}" first.`,
					});
				}

				if (before.requiresPhoto) {
					// Uploads by workers (template documents don't count).
					const uploads = await db.$count(
						buildTaskAttachmentTable,
						and(
							eq(buildTaskAttachmentTable.buildTaskId, before.id),
							isNull(buildTaskAttachmentTable.templateDocumentId),
						),
					);
					if (uploads === 0) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "This task requires a photo before it can be completed.",
						});
					}
				}

				if (before.requiresComment) {
					const comments = await db.$count(
						buildTaskCommentTable,
						eq(buildTaskCommentTable.buildTaskId, before.id),
					);
					if (comments === 0) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message:
								"This task requires a comment before it can be completed.",
						});
					}
				}
			}

			const now = new Date();
			const [after] = await db
				.update(buildTaskTable)
				.set({
					status: input.status,
					actualStartedAt:
						before.actualStartedAt ??
						(input.status !== BuildTaskStatus.todo ? now : null),
					actualCompletedAt: input.status === BuildTaskStatus.done ? now : null,
					completedById:
						input.status === BuildTaskStatus.done ? ctx.user.id : null,
				})
				.where(eq(buildTaskTable.id, before.id))
				.returning();

			if (!after) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update task status.",
				});
			}

			await Promise.all([
				logActivity({
					organizationId: ctx.organization.id,
					buildId: before.buildId,
					buildTaskId: before.id,
					actorId: ctx.user.id,
					action: ActivityAction.taskStatusChanged,
					metadata: { from: before.status, to: input.status },
				}),
				recordRevision({
					organizationId: ctx.organization.id,
					entityType: RevisionEntity.buildTask,
					entityId: before.id,
					action: RevisionAction.update,
					changedById: ctx.user.id,
					before,
					after,
				}),
				syncBuildStatus(before.buildId),
			]);

			const build = await getOwnedBuild(before.buildId, ctx.organization.id);
			await notifyTaskStatusChanged({
				organizationId: ctx.organization.id,
				actorId: ctx.user.id,
				actorName: ctx.user.name,
				task: { id: before.id, title: before.title, buildId: before.buildId },
				serialNumber: build.serialNumber,
				from: before.status,
				to: input.status,
			});

			return after;
		}),

	updateChecklistItem: protectedOrganizationProcedure
		.input(updateBuildTaskChecklistItemSchema)
		.mutation(async ({ ctx, input }) => {
			const item = await db.query.buildTaskChecklistItemTable.findFirst({
				where: eq(buildTaskChecklistItemTable.id, input.id),
			});
			if (!item) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Checklist item not found.",
				});
			}

			const task = await getOwnedBuildTask(
				item.buildTaskId,
				ctx.organization.id,
			);
			await assertCanWorkOn(task.id, ctx.user.id, ctx.membership.role);

			const done = input.status !== ChecklistItemStatus.open;
			const [updated] = await db
				.update(buildTaskChecklistItemTable)
				.set({
					status: input.status,
					completedById: done ? ctx.user.id : null,
					completedAt: done ? new Date() : null,
				})
				.where(eq(buildTaskChecklistItemTable.id, input.id))
				.returning();

			await logActivity({
				organizationId: ctx.organization.id,
				buildId: task.buildId,
				buildTaskId: task.id,
				actorId: ctx.user.id,
				action: ActivityAction.taskChecklistUpdated,
				metadata: { itemId: input.id, title: item.title, status: input.status },
			});

			return updated;
		}),

	addComment: protectedOrganizationProcedure
		.input(addBuildTaskCommentSchema)
		.mutation(async ({ ctx, input }) => {
			const task = await getOwnedBuildTask(
				input.buildTaskId,
				ctx.organization.id,
			);
			// Any org member may comment; being assigned is not required so that
			// helpers and planners can leave notes.

			const [comment] = await db
				.insert(buildTaskCommentTable)
				.values({
					buildTaskId: task.id,
					authorId: ctx.user.id,
					body: input.body,
				})
				.returning();

			await logActivity({
				organizationId: ctx.organization.id,
				buildId: task.buildId,
				buildTaskId: task.id,
				actorId: ctx.user.id,
				action: ActivityAction.taskCommented,
				metadata: { commentId: comment?.id ?? null },
			});

			const build = await getOwnedBuild(task.buildId, ctx.organization.id);
			await notifyTaskCommented({
				organizationId: ctx.organization.id,
				actorId: ctx.user.id,
				actorName: ctx.user.name,
				task: { id: task.id, title: task.title, buildId: task.buildId },
				serialNumber: build.serialNumber,
				body: input.body,
			});

			return comment;
		}),

	deleteComment: protectedOrganizationProcedure
		.input(deleteBuildTaskCommentSchema)
		.mutation(async ({ ctx, input }) => {
			const comment = await db.query.buildTaskCommentTable.findFirst({
				where: eq(buildTaskCommentTable.id, input.id),
			});
			if (!comment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Comment not found.",
				});
			}
			await getOwnedBuildTask(comment.buildTaskId, ctx.organization.id);

			if (comment.authorId !== ctx.user.id && !canPlan(ctx.membership.role)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only delete your own comments.",
				});
			}

			await db
				.delete(buildTaskCommentTable)
				.where(eq(buildTaskCommentTable.id, input.id));

			return { success: true };
		}),

	attachmentUploadUrl: protectedOrganizationProcedure
		.input(buildTaskAttachmentUploadUrlSchema)
		.mutation(async ({ ctx, input }) => {
			const task = await getOwnedBuildTask(
				input.buildTaskId,
				ctx.organization.id,
			);
			await assertCanWorkOn(task.id, ctx.user.id, ctx.membership.role);

			const storageKey = `orgs/${ctx.organization.id}/builds/${task.buildId}/tasks/${task.id}/${crypto.randomUUID()}-${sanitizeFileName(input.fileName)}`;
			const signedUrl = await getSignedUploadUrl(
				storageKey,
				storageConfig.bucketNames.images,
				input.contentType ?? "application/octet-stream",
			);

			return { storageKey, signedUrl };
		}),

	addAttachment: protectedOrganizationProcedure
		.input(addBuildTaskAttachmentSchema)
		.mutation(async ({ ctx, input }) => {
			const task = await getOwnedBuildTask(
				input.buildTaskId,
				ctx.organization.id,
			);
			await assertCanWorkOn(task.id, ctx.user.id, ctx.membership.role);

			if (!input.storageKey.startsWith(`orgs/${ctx.organization.id}/`)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid storage key.",
				});
			}

			const [attachment] = await db
				.insert(buildTaskAttachmentTable)
				.values({
					buildTaskId: task.id,
					uploadedById: ctx.user.id,
					storageKey: input.storageKey,
					fileName: input.fileName,
					contentType: input.contentType ?? null,
					sizeBytes: input.sizeBytes ?? null,
					caption: input.caption ?? null,
				})
				.returning();

			await logActivity({
				organizationId: ctx.organization.id,
				buildId: task.buildId,
				buildTaskId: task.id,
				actorId: ctx.user.id,
				action: ActivityAction.taskAttachmentAdded,
				metadata: {
					attachmentId: attachment?.id ?? null,
					fileName: input.fileName,
				},
			});

			return attachment;
		}),

	deleteAttachment: protectedOrganizationProcedure
		.input(deleteBuildTaskAttachmentSchema)
		.mutation(async ({ ctx, input }) => {
			const attachment = await db.query.buildTaskAttachmentTable.findFirst({
				where: eq(buildTaskAttachmentTable.id, input.id),
			});
			if (!attachment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Attachment not found.",
				});
			}
			await getOwnedBuildTask(attachment.buildTaskId, ctx.organization.id);

			if (attachment.templateDocumentId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Template documents cannot be removed from a task.",
				});
			}
			if (
				attachment.uploadedById !== ctx.user.id &&
				!canPlan(ctx.membership.role)
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only delete your own uploads.",
				});
			}

			await db
				.delete(buildTaskAttachmentTable)
				.where(eq(buildTaskAttachmentTable.id, input.id));

			return { success: true };
		}),

	attachmentDownloadUrl: protectedOrganizationProcedure
		.input(attachmentDownloadUrlSchema)
		.query(async ({ ctx, input }) => {
			const attachment = await db.query.buildTaskAttachmentTable.findFirst({
				where: eq(buildTaskAttachmentTable.id, input.attachmentId),
			});
			if (!attachment) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Attachment not found.",
				});
			}
			await getOwnedBuildTask(attachment.buildTaskId, ctx.organization.id);

			const url = await getSignedUrl(
				attachment.storageKey,
				storageConfig.bucketNames.images,
				60 * 10,
			);

			return {
				url,
				fileName: attachment.fileName,
				contentType: attachment.contentType,
			};
		}),

	activity: protectedOrganizationProcedure
		.input(listBuildTaskActivitySchema)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(buildTaskActivityTable.organizationId, ctx.organization.id),
			];
			if (input.buildTaskId) {
				conditions.push(
					eq(buildTaskActivityTable.buildTaskId, input.buildTaskId),
				);
			}
			if (input.buildId) {
				conditions.push(eq(buildTaskActivityTable.buildId, input.buildId));
			}

			return db.query.buildTaskActivityTable.findMany({
				where: and(...conditions),
				orderBy: desc(buildTaskActivityTable.createdAt),
				limit: input.limit,
				with: {
					actor: { columns: { id: true, name: true, image: true } },
					buildTask: { columns: { id: true, title: true } },
					build: { columns: { id: true, serialNumber: true } },
				},
			});
		}),
});
