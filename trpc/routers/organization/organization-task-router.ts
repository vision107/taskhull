import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
	labelTable,
	projectMemberTable,
	projectTable,
	taskActivityTable,
	taskAttachmentTable,
	taskCommentTable,
	taskDependencyTable,
	taskLabelTable,
	taskStatusTable,
	taskTable,
} from "@/lib/db/schema/tables";
import { ActivityType, type TaskPriority, TaskStatusType } from "@/lib/db/schema/enums";
import {
	addDependencySchema,
	bulkCompleteTasksSchema,
	bulkUpdateTasksSchema,
	createAttachmentSchema,
	createCommentSchema,
	createTaskSchema,
	deleteAttachmentSchema,
	deleteCommentSchema,
	deleteTaskSchema,
	getTaskSchema,
	getTemplateStatsSchema,
	listActivitiesSchema,
	listCommentsSchema,
	listTasksForOrgSchema,
	listTasksSchema,
	removeDependencySchema,
	reorderTasksSchema,
	updateCommentSchema,
	updateTaskSchema,
	updateTaskStatusAssignmentSchema,
} from "@/schemas/project-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

async function assertTaskAccess(
	taskId: string,
	userId: string,
	orgRole: string,
) {
	if (orgRole === "owner" || orgRole === "admin") return null;

	const task = await db.query.taskTable.findFirst({
		where: eq(taskTable.id, taskId),
	});
	if (!task) throw new TRPCError({ code: "NOT_FOUND" });

	const membership = await db.query.projectMemberTable.findFirst({
		where: and(
			eq(projectMemberTable.projectId, task.projectId),
			eq(projectMemberTable.userId, userId),
		),
	});
	if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

	return { task, membership };
}

async function recordActivity(
	taskId: string,
	userId: string,
	type: ActivityType,
	oldValue?: string | null,
	newValue?: string | null,
	meta?: Record<string, unknown>,
) {
	await db.insert(taskActivityTable).values({
		taskId,
		userId,
		type,
		oldValue: oldValue ?? null,
		newValue: newValue ?? null,
		meta: meta ?? null,
	});
}

export const organizationTaskRouter = createTRPCRouter({
	list: protectedOrganizationProcedure
		.input(listTasksSchema)
		.query(async ({ input }) => {
			const conditions = [eq(taskTable.projectId, input.projectId)];

			if (input.assigneeId) {
				conditions.push(eq(taskTable.assigneeId, input.assigneeId));
			}
			if (input.statusId) {
				conditions.push(eq(taskTable.statusId, input.statusId));
			}
			if (input.priority) {
				conditions.push(
					eq(taskTable.priority, input.priority as TaskPriority),
				);
			}
			if (input.parentId !== undefined) {
				conditions.push(
					input.parentId
						? eq(taskTable.parentId, input.parentId)
						: isNull(taskTable.parentId),
				);
			}
			if (input.dueDateFrom) {
				conditions.push(gte(taskTable.dueDate, input.dueDateFrom));
			}
			if (input.dueDateTo) {
				conditions.push(lte(taskTable.dueDate, input.dueDateTo));
			}
			if (input.startDateFrom) {
				conditions.push(gte(taskTable.startDate, input.startDateFrom));
			}
			if (input.startDateTo) {
				conditions.push(lte(taskTable.startDate, input.startDateTo));
			}
			if (input.query) {
				conditions.push(ilike(taskTable.title, `%${input.query}%`));
			}
			if (!input.includeCompleted) {
				conditions.push(isNull(taskTable.completedAt));
			}

			const tasks = await db.query.taskTable.findMany({
				where: and(...conditions),
				with: {
					status: true,
					assignee: true,
					labels: { with: { label: true } },
					subtasks: {
						with: { status: true, assignee: true },
					},
				},
				orderBy: [asc(taskTable.sortOrder), asc(taskTable.createdAt)],
				limit: input.limit,
				offset: input.offset,
			});

			// Filter by label if requested
			if (input.labelIds && input.labelIds.length > 0) {
				const labelSet = new Set(input.labelIds);
				return tasks.filter((t) =>
					t.labels.some((tl) => labelSet.has(tl.labelId)),
				);
			}

			return tasks;
		}),

	/**
	 * Cross-project task list, scoped to the caller's organization.
	 * Powers the desktop "My Tasks" page and mobile tasks list.
	 */
	listForOrg: protectedOrganizationProcedure
		.input(listTasksForOrgSchema)
		.query(async ({ ctx, input }) => {
			// Determine accessible project IDs: org admins see all, others
			// see only projects they are members of.
			const orgRole = ctx.membership.role;
			const isOrgAdmin = orgRole === "owner" || orgRole === "admin";

			let accessibleProjectIds: string[];
			if (isOrgAdmin) {
				const projects = await db.query.projectTable.findMany({
					where: eq(projectTable.organizationId, ctx.organization.id),
					columns: { id: true },
				});
				accessibleProjectIds = projects.map((p) => p.id);
			} else {
				const memberships = await db.query.projectMemberTable.findMany({
					where: eq(projectMemberTable.userId, ctx.user.id),
					with: { project: { columns: { id: true, organizationId: true } } },
				});
				accessibleProjectIds = memberships
					.filter((m) => m.project.organizationId === ctx.organization.id)
					.map((m) => m.projectId);
			}

			if (input.projectIds && input.projectIds.length > 0) {
				const allowed = new Set(accessibleProjectIds);
				accessibleProjectIds = input.projectIds.filter((id) => allowed.has(id));
			}

			if (accessibleProjectIds.length === 0) {
				return [];
			}

			const conditions = [inArray(taskTable.projectId, accessibleProjectIds)];

			// Assignee: explicit value > onlyMine > no filter
			if (input.assigneeId === null) {
				conditions.push(isNull(taskTable.assigneeId));
			} else if (input.assigneeId) {
				conditions.push(eq(taskTable.assigneeId, input.assigneeId));
			} else if (input.onlyMine) {
				conditions.push(eq(taskTable.assigneeId, ctx.user.id));
			}

			if (input.priority) {
				conditions.push(
					eq(taskTable.priority, input.priority as TaskPriority),
				);
			}
			if (input.query) {
				conditions.push(ilike(taskTable.title, `%${input.query}%`));
			}
			if (input.dueDateFrom) {
				conditions.push(gte(taskTable.dueDate, input.dueDateFrom));
			}
			if (input.dueDateTo) {
				conditions.push(lte(taskTable.dueDate, input.dueDateTo));
			}
			if (!input.includeCompleted) {
				conditions.push(isNull(taskTable.completedAt));
			}

			const tasks = await db.query.taskTable.findMany({
				where: and(...conditions),
				with: {
					status: true,
					assignee: true,
					project: {
						columns: {
							id: true,
							name: true,
							color: true,
							templateProjectId: true,
						},
					},
					labels: { with: { label: true } },
				},
				orderBy: [
					desc(taskTable.priority),
					asc(taskTable.dueDate),
					asc(taskTable.createdAt),
				],
				limit: input.limit,
				offset: input.offset,
			});

			// Optionally filter by status types (todo/in_progress/done/cancelled).
			if (input.statusTypes && input.statusTypes.length > 0) {
				const allowed = new Set(input.statusTypes);
				return tasks.filter(
					(t) => t.status && allowed.has(t.status.type),
				);
			}

			return tasks;
		}),

	get: protectedOrganizationProcedure
		.input(getTaskSchema)
		.query(async ({ ctx, input }) => {
			await assertTaskAccess(input.id, ctx.user.id, ctx.membership.role);

			const task = await db.query.taskTable.findFirst({
				where: eq(taskTable.id, input.id),
				with: {
					status: true,
					assignee: true,
					createdBy: true,
					parent: true,
					subtasks: { with: { status: true, assignee: true } },
					labels: { with: { label: true } },
					comments: {
						with: { user: true },
						orderBy: asc(taskCommentTable.createdAt),
					},
					attachments: { with: { user: true } },
					activities: {
						with: { user: true },
						orderBy: desc(taskActivityTable.createdAt),
					},
					predecessorDependencies: {
						with: { predecessor: true },
					},
					successorDependencies: {
						with: { successor: true },
					},
				},
			});

			if (!task) throw new TRPCError({ code: "NOT_FOUND" });
			return task;
		}),

	create: protectedOrganizationProcedure
		.input(createTaskSchema)
		.mutation(async ({ ctx, input }) => {
			// Get next sequence id for this project
			const [seqResult] = await db
				.select({ maxSeq: sql<number>`coalesce(max(${taskTable.sequenceId}), 0)` })
				.from(taskTable)
				.where(eq(taskTable.projectId, input.projectId));

			const nextSeq = (seqResult?.maxSeq ?? 0) + 1;

			// Get max sortOrder
			const [sortResult] = await db
				.select({ maxSort: sql<number>`coalesce(max(${taskTable.sortOrder}), 0)` })
				.from(taskTable)
				.where(eq(taskTable.projectId, input.projectId));
			const nextSort = (sortResult?.maxSort ?? 0) + 1000;

			const { labelIds, ...taskData } = input;

			const [task] = await db
				.insert(taskTable)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.values({
					...taskData,
					sequenceId: nextSeq,
					sortOrder: nextSort,
					createdById: ctx.user.id,
				} as any)
				.returning();

			if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

			// Add labels
			if (labelIds && labelIds.length > 0) {
				await db
					.insert(taskLabelTable)
					.values(labelIds.map((labelId) => ({ taskId: task.id, labelId })));
			}

			await recordActivity(task.id, ctx.user.id, "created");

			return db.query.taskTable.findFirst({
				where: eq(taskTable.id, task.id),
				with: { status: true, assignee: true, labels: { with: { label: true } } },
			});
		}),

	update: protectedOrganizationProcedure
		.input(updateTaskSchema)
		.mutation(async ({ ctx, input }) => {
			const result = await assertTaskAccess(
				input.id,
				ctx.user.id,
				ctx.membership.role,
			);

			const oldTask =
				result?.task ??
				(await db.query.taskTable.findFirst({
					where: eq(taskTable.id, input.id),
				}));

			const { id, labelIds, ...data } = input;

			// Track completion
			if (data.statusId !== undefined && data.statusId !== oldTask?.statusId) {
				const newStatus = data.statusId
					? await db.query.taskStatusTable.findFirst({
							where: eq(taskStatusTable.id, data.statusId),
						})
					: null;

				if (newStatus?.type === "done" && !oldTask?.completedAt) {
					(data as Record<string, unknown>).completedAt = new Date();
					await recordActivity(id, ctx.user.id, "completed");
				} else if (newStatus?.type !== "done" && oldTask?.completedAt) {
					(data as Record<string, unknown>).completedAt = null;
					await recordActivity(id, ctx.user.id, "reopened");
				}

				await recordActivity(id, ctx.user.id, "status_changed", oldTask?.statusId ?? null, data.statusId ?? null);
			}

			if (data.assigneeId !== undefined && data.assigneeId !== oldTask?.assigneeId) {
				await recordActivity(id, ctx.user.id, "assignee_changed", oldTask?.assigneeId ?? null, data.assigneeId ?? null);
			}

			if (data.priority !== undefined && data.priority !== oldTask?.priority) {
				await recordActivity(id, ctx.user.id, "priority_changed", oldTask?.priority, data.priority);
			}

			if (data.dueDate !== undefined) {
				await recordActivity(id, ctx.user.id, "due_date_changed", oldTask?.dueDate?.toISOString() ?? null, data.dueDate?.toISOString() ?? null);
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await db.update(taskTable).set(data as any).where(eq(taskTable.id, id));

			// Update labels if provided
			if (labelIds !== undefined) {
				await db.delete(taskLabelTable).where(eq(taskLabelTable.taskId, id));
				if (labelIds.length > 0) {
					await db
						.insert(taskLabelTable)
						.values(labelIds.map((labelId) => ({ taskId: id, labelId })));
				}
			}

			return db.query.taskTable.findFirst({
				where: eq(taskTable.id, id),
				with: { status: true, assignee: true, labels: { with: { label: true } } },
			});
		}),

	updateStatus: protectedOrganizationProcedure
		.input(updateTaskStatusAssignmentSchema)
		.mutation(async ({ ctx, input }) => {
			const oldTask = await db.query.taskTable.findFirst({
				where: eq(taskTable.id, input.id),
			});
			if (!oldTask) throw new TRPCError({ code: "NOT_FOUND" });

			await assertTaskAccess(input.id, ctx.user.id, ctx.membership.role);

			const newStatus = input.statusId
				? await db.query.taskStatusTable.findFirst({
						where: eq(taskStatusTable.id, input.statusId),
					})
				: null;

			const completedAt =
				newStatus?.type === "done" && !oldTask.completedAt
					? new Date()
					: newStatus?.type !== "done" && oldTask.completedAt
						? null
						: oldTask.completedAt;

			await db
				.update(taskTable)
				.set({ statusId: input.statusId, completedAt })
				.where(eq(taskTable.id, input.id));

			await recordActivity(
				input.id,
				ctx.user.id,
				"status_changed",
				oldTask.statusId ?? null,
				input.statusId ?? null,
			);

			if (newStatus?.type === "done" && !oldTask.completedAt) {
				await recordActivity(input.id, ctx.user.id, "completed");
			}
		}),

	delete: protectedOrganizationProcedure
		.input(deleteTaskSchema)
		.mutation(async ({ ctx, input }) => {
			await assertTaskAccess(input.id, ctx.user.id, ctx.membership.role);
			await db.delete(taskTable).where(eq(taskTable.id, input.id));
		}),

	bulkUpdate: protectedOrganizationProcedure
		.input(bulkUpdateTasksSchema)
		.mutation(async ({ input }) => {
			const { ids, ...data } = input;

			// Build update object only with defined fields
			const updateData: Record<string, unknown> = {};
			if (data.statusId !== undefined) updateData.statusId = data.statusId;
			if (data.priority !== undefined) updateData.priority = data.priority;
			if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
			if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

			await db
				.update(taskTable)
				.set(updateData)
				.where(inArray(taskTable.id, ids));
		}),

	/**
	 * Complete multiple tasks at once by picking each task's project "done"
	 * status. Used by the "batch complete identical tasks across projects"
	 * worker flow. The caller must be able to access each referenced project.
	 */
	bulkComplete: protectedOrganizationProcedure
		.input(bulkCompleteTasksSchema)
		.mutation(async ({ ctx, input }) => {
			const tasks = await db.query.taskTable.findMany({
				where: inArray(taskTable.id, input.ids),
			});
			if (tasks.length === 0) return { completed: 0 };

			const orgRole = ctx.membership.role;
			const isOrgAdmin = orgRole === "owner" || orgRole === "admin";

			if (!isOrgAdmin) {
				const memberships = await db.query.projectMemberTable.findMany({
					where: eq(projectMemberTable.userId, ctx.user.id),
					columns: { projectId: true },
				});
				const accessible = new Set(memberships.map((m) => m.projectId));
				for (const t of tasks) {
					if (!accessible.has(t.projectId)) {
						throw new TRPCError({ code: "FORBIDDEN" });
					}
				}
			}

			const projectIds = Array.from(new Set(tasks.map((t) => t.projectId)));
			const doneStatuses = await db.query.taskStatusTable.findMany({
				where: and(
					inArray(taskStatusTable.projectId, projectIds),
					eq(taskStatusTable.type, TaskStatusType.done),
				),
			});
			const doneByProject = new Map<string, string>();
			for (const s of doneStatuses) {
				if (!doneByProject.has(s.projectId)) {
					doneByProject.set(s.projectId, s.id);
				}
			}

			let completed = 0;
			await Promise.all(
				tasks.map(async (t) => {
					if (t.completedAt) return;
					const statusId = doneByProject.get(t.projectId);
					const now = new Date();
					await db
						.update(taskTable)
						.set({
							statusId: statusId ?? t.statusId,
							completedAt: now,
						})
						.where(eq(taskTable.id, t.id));
					await recordActivity(
						t.id,
						ctx.user.id,
						ActivityType.statusChanged,
						t.statusId ?? null,
						statusId ?? null,
					);
					await recordActivity(t.id, ctx.user.id, ActivityType.completed);
					completed++;
				}),
			);

			return { completed };
		}),

	/**
	 * Walk the templateTaskId chain from the given task back to the root,
	 * then aggregate actual vs estimated hours and completion counts across
	 * all tasks in the chain.
	 */
	getTemplateStats: protectedOrganizationProcedure
		.input(getTemplateStatsSchema)
		.query(async ({ input }) => {
			type TemplateTask = NonNullable<
				Awaited<ReturnType<typeof db.query.taskTable.findFirst>>
			>;

			const start = await db.query.taskTable.findFirst({
				where: eq(taskTable.id, input.taskId),
			});
			if (!start) throw new TRPCError({ code: "NOT_FOUND" });

			let current: TemplateTask = start;
			const visited = new Set<string>([current.id]);
			while (current.templateTaskId && !visited.has(current.templateTaskId)) {
				const parent: TemplateTask | undefined =
					await db.query.taskTable.findFirst({
						where: eq(taskTable.id, current.templateTaskId),
					});
				if (!parent) break;
				visited.add(parent.id);
				current = parent;
			}
			const rootTask: TemplateTask = current;

			const allTasks: TemplateTask[] = [rootTask];
			let frontier: string[] = [rootTask.id];
			while (frontier.length > 0) {
				const children: TemplateTask[] =
					await db.query.taskTable.findMany({
						where: inArray(taskTable.templateTaskId, frontier),
					});
				if (children.length === 0) break;
				allTasks.push(...children);
				frontier = children.map((c) => c.id);
			}

			const projectIds = Array.from(
				new Set(allTasks.map((t) => t.projectId)),
			);
			const projects = await db.query.projectTable.findMany({
				where: inArray(projectTable.id, projectIds),
			});
			const projectById = new Map(projects.map((p) => [p.id, p]));

			const completed = allTasks.filter(
				(t): t is TemplateTask => t.completedAt !== null,
			);
			const estimates = allTasks
				.map((t) => t.estimatedHours)
				.filter((v): v is number => v != null);
			const actuals = allTasks
				.map((t) => t.actualHours)
				.filter((v): v is number => v != null);

			const avg = (arr: number[]) =>
				arr.length === 0
					? null
					: arr.reduce((acc, n) => acc + n, 0) / arr.length;

			const instances = allTasks
				.map((t) => ({
					id: t.id,
					projectId: t.projectId,
					projectName:
						projectById.get(t.projectId)?.name ?? "(unknown project)",
					title: t.title,
					completed: t.completedAt !== null,
					completedAt: t.completedAt,
					estimatedHours: t.estimatedHours,
					actualHours: t.actualHours,
				}))
				.sort((a, b) => {
					if (a.completed && !b.completed) return -1;
					if (!a.completed && b.completed) return 1;
					return 0;
				});

			return {
				rootTaskId: rootTask.id,
				rootTitle: rootTask.title,
				instanceCount: allTasks.length,
				completedCount: completed.length,
				avgEstimatedHours: avg(estimates),
				avgActualHours: avg(actuals),
				instances,
				recent: instances.slice(0, 5),
			};
		}),

	reorder: protectedOrganizationProcedure
		.input(reorderTasksSchema)
		.mutation(async ({ input }) => {
			await Promise.all(
				input.updates.map(({ id, sortOrder }) =>
					db
						.update(taskTable)
						.set({ sortOrder })
						.where(eq(taskTable.id, id)),
				),
			);
		}),

	// ─── Comments ────────────────────────────────────────────────────────────

	listComments: protectedOrganizationProcedure
		.input(listCommentsSchema)
		.query(async ({ input }) => {
			return db.query.taskCommentTable.findMany({
				where: eq(taskCommentTable.taskId, input.taskId),
				with: { user: true },
				orderBy: asc(taskCommentTable.createdAt),
			});
		}),

	createComment: protectedOrganizationProcedure
		.input(createCommentSchema)
		.mutation(async ({ ctx, input }) => {
			const [comment] = await db
				.insert(taskCommentTable)
				.values({
					taskId: input.taskId,
					userId: ctx.user.id,
					content: input.content,
				})
				.returning();

			await recordActivity(input.taskId, ctx.user.id, "comment_added", null, comment?.id);

			return db.query.taskCommentTable.findFirst({
				where: eq(taskCommentTable.id, comment!.id),
				with: { user: true },
			});
		}),

	updateComment: protectedOrganizationProcedure
		.input(updateCommentSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.taskCommentTable.findFirst({
				where: eq(taskCommentTable.id, input.id),
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
			if (existing.userId !== ctx.user.id) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You can only edit your own comments.",
				});
			}

			const [updated] = await db
				.update(taskCommentTable)
				.set({ content: input.content })
				.where(eq(taskCommentTable.id, input.id))
				.returning();

			return db.query.taskCommentTable.findFirst({
				where: eq(taskCommentTable.id, updated!.id),
				with: { user: true },
			});
		}),

	deleteComment: protectedOrganizationProcedure
		.input(deleteCommentSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.taskCommentTable.findFirst({
				where: eq(taskCommentTable.id, input.id),
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
			if (existing.userId !== ctx.user.id && ctx.membership.role === "member") {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			await db
				.delete(taskCommentTable)
				.where(eq(taskCommentTable.id, input.id));
		}),

	// ─── Activities ───────────────────────────────────────────────────────────

	listActivities: protectedOrganizationProcedure
		.input(listActivitiesSchema)
		.query(async ({ input }) => {
			return db.query.taskActivityTable.findMany({
				where: eq(taskActivityTable.taskId, input.taskId),
				with: { user: true },
				orderBy: desc(taskActivityTable.createdAt),
				limit: input.limit,
				offset: input.offset,
			});
		}),

	// ─── Dependencies ─────────────────────────────────────────────────────────

	addDependency: protectedOrganizationProcedure
		.input(addDependencySchema)
		.mutation(async ({ input }) => {
			if (input.predecessorId === input.successorId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A task cannot depend on itself.",
				});
			}

			const [dep] = await db
				.insert(taskDependencyTable)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.values({
					predecessorId: input.predecessorId,
					successorId: input.successorId,
					type: input.type,
				} as any)
				.onConflictDoNothing()
				.returning();

			return dep;
		}),

	removeDependency: protectedOrganizationProcedure
		.input(removeDependencySchema)
		.mutation(async ({ input }) => {
			await db
				.delete(taskDependencyTable)
				.where(eq(taskDependencyTable.id, input.id));
		}),

	// ─── Attachments ──────────────────────────────────────────────────────────

	createAttachment: protectedOrganizationProcedure
		.input(createAttachmentSchema)
		.mutation(async ({ ctx, input }) => {
			const [attachment] = await db
				.insert(taskAttachmentTable)
				.values({
					taskId: input.taskId,
					userId: ctx.user.id,
					fileName: input.fileName,
					fileKey: input.fileKey,
					fileSize: input.fileSize,
					mimeType: input.mimeType,
				})
				.returning();

			await recordActivity(
				input.taskId,
				ctx.user.id,
				"attachment_added",
				null,
				input.fileName,
			);

			return attachment;
		}),

	deleteAttachment: protectedOrganizationProcedure
		.input(deleteAttachmentSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.taskAttachmentTable.findFirst({
				where: eq(taskAttachmentTable.id, input.id),
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

			await db
				.delete(taskAttachmentTable)
				.where(eq(taskAttachmentTable.id, input.id));

			await recordActivity(
				existing.taskId,
				ctx.user.id,
				"attachment_removed",
				existing.fileName,
				null,
			);
		}),
});
