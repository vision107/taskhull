import { TRPCError } from "@trpc/server";
import { differenceInCalendarDays } from "date-fns";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	labelTable,
	projectFavoriteTable,
	projectMemberTable,
	projectTable,
	taskDependencyTable,
	taskLabelTable,
	taskStatusTable,
	taskTable,
	userTable,
} from "@/lib/db/schema/tables";
import { ProjectRole, type TaskStatusType } from "@/lib/db/schema/enums";
import {
	addProjectMemberSchema,
	cloneProjectSchema,
	createLabelSchema,
	createProjectSchema,
	createTaskStatusSchema,
	deleteLabelSchema,
	deleteProjectSchema,
	deleteTaskStatusSchema,
	favoriteProjectSchema,
	getProjectSchema,
	removeProjectMemberSchema,
	shiftProjectSchema,
	unfavoriteProjectSchema,
	updateLabelSchema,
	updateProjectMemberSchema,
	updateProjectSchema,
	updateTaskStatusConfigSchema,
} from "@/schemas/project-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

/** Verify the current user has manager role on the project (or is org owner/admin) */
async function assertProjectManager(
	projectId: string,
	userId: string,
	orgMemberRole: string,
) {
	if (orgMemberRole === "owner" || orgMemberRole === "admin") return;

	const membership = await db.query.projectMemberTable.findFirst({
		where: and(
			eq(projectMemberTable.projectId, projectId),
			eq(projectMemberTable.userId, userId),
		),
	});

	if (!membership || membership.role !== ProjectRole.manager) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You must be a project manager to perform this action.",
		});
	}
}

/** Verify user is a member of the project (any role) */
async function assertProjectAccess(
	projectId: string,
	userId: string,
	orgMemberRole: string,
) {
	if (orgMemberRole === "owner" || orgMemberRole === "admin") return;

	const membership = await db.query.projectMemberTable.findFirst({
		where: and(
			eq(projectMemberTable.projectId, projectId),
			eq(projectMemberTable.userId, userId),
		),
	});

	if (!membership) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
	}
}

const DEFAULT_STATUSES: Array<{
	name: string;
	color: string;
	type: TaskStatusType;
	order: number;
}> = [
	{ name: "Backlog", color: "#94a3b8", type: "todo", order: 0 },
	{ name: "To Do", color: "#60a5fa", type: "todo", order: 1 },
	{ name: "In Progress", color: "#f59e0b", type: "in_progress", order: 2 },
	{ name: "In Review", color: "#a78bfa", type: "in_progress", order: 3 },
	{ name: "Done", color: "#22c55e", type: "done", order: 4 },
	{ name: "Cancelled", color: "#f43f5e", type: "cancelled", order: 5 },
];

export const organizationProjectRouter = createTRPCRouter({
	list: protectedOrganizationProcedure.query(async ({ ctx }) => {
		const orgRole = ctx.membership.role;
		const isOrgAdmin = orgRole === "owner" || orgRole === "admin";

		const favorites = await db.query.projectFavoriteTable.findMany({
			where: eq(projectFavoriteTable.userId, ctx.user.id),
		});
		const favoriteIds = new Set(favorites.map((f) => f.projectId));
		const withFavorite = <T extends { id: string }>(p: T) => ({
			...p,
			isFavorite: favoriteIds.has(p.id),
		});

		if (isOrgAdmin) {
			const projects = await db.query.projectTable.findMany({
				where: eq(projectTable.organizationId, ctx.organization.id),
				with: {
					members: { with: { user: true } },
					createdBy: true,
				},
				orderBy: asc(projectTable.createdAt),
			});
			return projects.map(withFavorite);
		}

		// Return only projects the user is a member of
		const memberships = await db.query.projectMemberTable.findMany({
			where: eq(projectMemberTable.userId, ctx.user.id),
			with: { project: { with: { members: { with: { user: true } }, createdBy: true } } },
		});

		return memberships
			.filter((m) => m.project.organizationId === ctx.organization.id)
			.map((m) => withFavorite(m.project));
	}),

	get: protectedOrganizationProcedure
		.input(getProjectSchema)
		.query(async ({ ctx, input }) => {
			await assertProjectAccess(
				input.id,
				ctx.user.id,
				ctx.membership.role,
			);

			const project = await db.query.projectTable.findFirst({
				where: and(
					eq(projectTable.id, input.id),
					eq(projectTable.organizationId, ctx.organization.id),
				),
				with: {
					members: { with: { user: true } },
					taskStatuses: { orderBy: asc(taskStatusTable.order) },
					labels: true,
					createdBy: true,
				},
			});

			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
			}

			return project;
		}),

	create: protectedOrganizationProcedure
		.input(createProjectSchema)
		.mutation(async ({ ctx, input }) => {
			const [project] = await db
				.insert(projectTable)
				.values({
					organizationId: ctx.organization.id,
					name: input.name,
					description: input.description,
					color: input.color,
					icon: input.icon,
					startDate: input.startDate,
					endDate: input.endDate,
					createdById: ctx.user.id,
				})
				.returning();

			if (!project) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

			// Add creator as manager
			await db.insert(projectMemberTable).values({
				projectId: project.id,
				userId: ctx.user.id,
				role: ProjectRole.manager,
			});

			// Seed default statuses
			await db.insert(taskStatusTable).values(
				DEFAULT_STATUSES.map((s) => ({ ...s, projectId: project.id })),
			);

			return project;
		}),

	update: protectedOrganizationProcedure
		.input(updateProjectSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectManager(input.id, ctx.user.id, ctx.membership.role);

			const { id, ...data } = input;
			const [updated] = await db
				.update(projectTable)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.set(data as any)
				.where(
					and(
						eq(projectTable.id, id),
						eq(projectTable.organizationId, ctx.organization.id),
					),
				)
				.returning();

			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedOrganizationProcedure
		.input(deleteProjectSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectManager(input.id, ctx.user.id, ctx.membership.role);

			await db
				.delete(projectTable)
				.where(
					and(
						eq(projectTable.id, input.id),
						eq(projectTable.organizationId, ctx.organization.id),
					),
				);
		}),

	/**
	 * Clone an existing project. Copies statuses, labels, tasks (top-level
	 * and subtasks), dependencies, and task labels. Sets templateProjectId on
	 * the new project and templateTaskId on each copied task so the clone
	 * chain can be walked later.
	 */
	clone: protectedOrganizationProcedure
		.input(cloneProjectSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectAccess(
				input.sourceProjectId,
				ctx.user.id,
				ctx.membership.role,
			);

			const source = await db.query.projectTable.findFirst({
				where: and(
					eq(projectTable.id, input.sourceProjectId),
					eq(projectTable.organizationId, ctx.organization.id),
				),
				with: {
					taskStatuses: true,
					labels: true,
				},
			});
			if (!source) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			// Compute date shift if requested
			let daysShift = 0;
			if (input.copyTaskDates && input.startDate && source.startDate) {
				daysShift = differenceInCalendarDays(
					input.startDate,
					source.startDate,
				);
			}
			const shiftDate = (d: Date | null): Date | null => {
				if (!d || !input.copyTaskDates) return null;
				if (daysShift === 0) return d;
				const next = new Date(d);
				next.setDate(next.getDate() + daysShift);
				return next;
			};

			// 1. Create new project
			const [newProject] = await db
				.insert(projectTable)
				.values({
					organizationId: ctx.organization.id,
					name: input.name,
					description: input.description ?? source.description,
					color: source.color,
					icon: source.icon,
					startDate: input.startDate ?? null,
					endDate:
						input.copyTaskDates && source.endDate
							? shiftDate(source.endDate)
							: null,
					templateProjectId: source.id,
					createdById: ctx.user.id,
				})
				.returning();

			if (!newProject) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
			}

			// Creator as manager
			await db.insert(projectMemberTable).values({
				projectId: newProject.id,
				userId: ctx.user.id,
				role: ProjectRole.manager,
			});

			// 2. Copy statuses, keep a mapping from source.id -> new.id
			const statusMap = new Map<string, string>();
			if (source.taskStatuses.length > 0) {
				const newStatuses = await db
					.insert(taskStatusTable)
					.values(
						source.taskStatuses.map((s) => ({
							projectId: newProject.id,
							name: s.name,
							color: s.color,
							type: s.type,
							order: s.order,
						})),
					)
					.returning();
				source.taskStatuses
					.sort((a, b) => a.order - b.order)
					.forEach((s, idx) => {
						const created = newStatuses[idx];
						if (created) statusMap.set(s.id, created.id);
					});
			} else {
				await db
					.insert(taskStatusTable)
					.values(
						DEFAULT_STATUSES.map((s) => ({
							...s,
							projectId: newProject.id,
						})),
					);
			}

			// 3. Copy labels
			const labelMap = new Map<string, string>();
			if (source.labels.length > 0) {
				const newLabels = await db
					.insert(labelTable)
					.values(
						source.labels.map((l) => ({
							projectId: newProject.id,
							name: l.name,
							color: l.color,
						})),
					)
					.returning();
				source.labels.forEach((l, idx) => {
					const created = newLabels[idx];
					if (created) labelMap.set(l.id, created.id);
				});
			}

			// 4. Copy tasks - two-pass so we can resolve parentId
			const sourceTasks = await db.query.taskTable.findMany({
				where: eq(taskTable.projectId, source.id),
				with: { labels: true },
				orderBy: asc(taskTable.sortOrder),
			});

			const taskMap = new Map<string, string>();
			if (sourceTasks.length > 0) {
				// First pass: create all tasks (parentId left null for now)
				const inserted = await db
					.insert(taskTable)
					.values(
						sourceTasks.map((t) => ({
							projectId: newProject.id,
							statusId: t.statusId ? statusMap.get(t.statusId) ?? null : null,
							title: t.title,
							description: t.description,
							priority: t.priority,
							assigneeId: input.copyAssignees ? t.assigneeId : null,
							parentId: null,
							templateTaskId: t.id,
							startDate: shiftDate(t.startDate),
							dueDate: shiftDate(t.dueDate),
							estimatedHours: t.estimatedHours,
							sequenceId: t.sequenceId,
							sortOrder: t.sortOrder,
							createdById: ctx.user.id,
						})),
					)
					.returning();
				sourceTasks.forEach((t, idx) => {
					const created = inserted[idx];
					if (created) taskMap.set(t.id, created.id);
				});

				// Second pass: patch parentId for subtasks
				const subtaskUpdates = sourceTasks
					.filter((t) => t.parentId)
					.map((t) => ({
						newId: taskMap.get(t.id),
						newParentId: taskMap.get(t.parentId as string),
					}))
					.filter(
						(u): u is { newId: string; newParentId: string } =>
							Boolean(u.newId && u.newParentId),
					);
				await Promise.all(
					subtaskUpdates.map(({ newId, newParentId }) =>
						db
							.update(taskTable)
							.set({ parentId: newParentId })
							.where(eq(taskTable.id, newId)),
					),
				);

				// 5. Copy task labels
				const taskLabelRows: Array<{ taskId: string; labelId: string }> = [];
				for (const t of sourceTasks) {
					const newTaskId = taskMap.get(t.id);
					if (!newTaskId) continue;
					for (const tl of t.labels) {
						const newLabelId = labelMap.get(tl.labelId);
						if (newLabelId) {
							taskLabelRows.push({ taskId: newTaskId, labelId: newLabelId });
						}
					}
				}
				if (taskLabelRows.length > 0) {
					await db.insert(taskLabelTable).values(taskLabelRows);
				}

				// 6. Copy task dependencies
				const sourceDeps = await db.query.taskDependencyTable.findMany({
					where: inArray(
						taskDependencyTable.predecessorId,
						sourceTasks.map((t) => t.id),
					),
				});
				const depRows = sourceDeps
					.map((d) => {
						const newPred = taskMap.get(d.predecessorId);
						const newSucc = taskMap.get(d.successorId);
						if (!newPred || !newSucc) return null;
						return {
							predecessorId: newPred,
							successorId: newSucc,
							type: d.type,
						};
					})
					.filter((d): d is NonNullable<typeof d> => d !== null);
				if (depRows.length > 0) {
					await db
						.insert(taskDependencyTable)
						.values(depRows)
						.onConflictDoNothing();
				}
			}

			return newProject;
		}),

	favorite: protectedOrganizationProcedure
		.input(favoriteProjectSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectAccess(
				input.projectId,
				ctx.user.id,
				ctx.membership.role,
			);
			await db
				.insert(projectFavoriteTable)
				.values({
					userId: ctx.user.id,
					projectId: input.projectId,
				})
				.onConflictDoNothing();
		}),

	unfavorite: protectedOrganizationProcedure
		.input(unfavoriteProjectSchema)
		.mutation(async ({ ctx, input }) => {
			await db
				.delete(projectFavoriteTable)
				.where(
					and(
						eq(projectFavoriteTable.userId, ctx.user.id),
						eq(projectFavoriteTable.projectId, input.projectId),
					),
				);
		}),

	shift: protectedOrganizationProcedure
		.input(shiftProjectSchema)
		.mutation(async ({ ctx, input }) => {
			if (input.days === 0) return { shiftedProjects: 0, shiftedTasks: 0 };

			const shiftDate = (d: Date | null): Date | null =>
				d === null ? null : new Date(d.getTime() + input.days * 86400000);

			const targetIds = new Set<string>([input.projectId]);
			if (input.cascadeClones) {
				let frontier: string[] = [input.projectId];
				while (frontier.length > 0) {
					const children = await db.query.projectTable.findMany({
						where: inArray(projectTable.templateProjectId, frontier),
					});
					const newIds = children
						.map((c) => c.id)
						.filter((id) => !targetIds.has(id));
					if (newIds.length === 0) break;
					for (const id of newIds) targetIds.add(id);
					frontier = newIds;
				}
			}

			for (const id of targetIds) {
				await assertProjectManager(id, ctx.user.id, ctx.membership.role);
			}

			const projects = await db.query.projectTable.findMany({
				where: and(
					inArray(projectTable.id, Array.from(targetIds)),
					eq(projectTable.organizationId, ctx.organization.id),
				),
			});

			for (const p of projects) {
				await db
					.update(projectTable)
					.set({
						startDate: shiftDate(p.startDate),
						endDate: shiftDate(p.endDate),
					})
					.where(eq(projectTable.id, p.id));
			}

			let shiftedTasks = 0;
			if (input.cascadeTasks && projects.length > 0) {
				const tasks = await db.query.taskTable.findMany({
					where: inArray(
						taskTable.projectId,
						projects.map((p) => p.id),
					),
				});
				for (const t of tasks) {
					if (t.startDate === null && t.dueDate === null) continue;
					await db
						.update(taskTable)
						.set({
							startDate: shiftDate(t.startDate),
							dueDate: shiftDate(t.dueDate),
						})
						.where(eq(taskTable.id, t.id));
					shiftedTasks += 1;
				}
			}

			return { shiftedProjects: projects.length, shiftedTasks };
		}),

	addMember: protectedOrganizationProcedure
		.input(addProjectMemberSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectManager(
				input.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			const user = await db.query.userTable.findFirst({
				where: eq(userTable.id, input.userId),
			});
			if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

			await db
				.insert(projectMemberTable)
				.values({
					projectId: input.projectId,
					userId: input.userId,
					role: input.role as ProjectRole,
				})
				.onConflictDoUpdate({
					target: [projectMemberTable.projectId, projectMemberTable.userId],
					set: { role: input.role as ProjectRole },
				});
		}),

	updateMember: protectedOrganizationProcedure
		.input(updateProjectMemberSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectManager(
				input.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			await db
				.update(projectMemberTable)
				.set({ role: input.role as ProjectRole })
				.where(
					and(
						eq(projectMemberTable.projectId, input.projectId),
						eq(projectMemberTable.userId, input.userId),
					),
				);
		}),

	removeMember: protectedOrganizationProcedure
		.input(removeProjectMemberSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectManager(
				input.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			await db
				.delete(projectMemberTable)
				.where(
					and(
						eq(projectMemberTable.projectId, input.projectId),
						eq(projectMemberTable.userId, input.userId),
					),
				);
		}),

	// ─── Task Statuses ──────────────────────────────────────────────────────

	createStatus: protectedOrganizationProcedure
		.input(createTaskStatusSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectManager(
				input.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			const [status] = await db
				.insert(taskStatusTable)
				.values({
					projectId: input.projectId,
					name: input.name,
					color: input.color,
					type: input.type as TaskStatusType,
					order: input.order ?? 0,
				})
				.returning();

			return status;
		}),

	updateStatus: protectedOrganizationProcedure
		.input(updateTaskStatusConfigSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.taskStatusTable.findFirst({
				where: eq(taskStatusTable.id, input.id),
				with: { project: true },
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

			await assertProjectManager(
				existing.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			const { id, ...data } = input;
			const [updated] = await db
				.update(taskStatusTable)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.set(data as any)
				.where(eq(taskStatusTable.id, id))
				.returning();

			return updated;
		}),

	deleteStatus: protectedOrganizationProcedure
		.input(deleteTaskStatusSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.taskStatusTable.findFirst({
				where: eq(taskStatusTable.id, input.id),
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

			await assertProjectManager(
				existing.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			await db.delete(taskStatusTable).where(eq(taskStatusTable.id, input.id));
		}),

	// ─── Labels ─────────────────────────────────────────────────────────────

	createLabel: protectedOrganizationProcedure
		.input(createLabelSchema)
		.mutation(async ({ ctx, input }) => {
			await assertProjectAccess(
				input.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			const [label] = await db
				.insert(labelTable)
				.values({
					projectId: input.projectId,
					name: input.name,
					color: input.color,
				})
				.returning();

			return label;
		}),

	updateLabel: protectedOrganizationProcedure
		.input(updateLabelSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.labelTable.findFirst({
				where: eq(labelTable.id, input.id),
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

			await assertProjectAccess(
				existing.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			const { id, ...data } = input;
			const [updated] = await db
				.update(labelTable)
				.set(data)
				.where(eq(labelTable.id, id))
				.returning();

			return updated;
		}),

	deleteLabel: protectedOrganizationProcedure
		.input(deleteLabelSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.labelTable.findFirst({
				where: eq(labelTable.id, input.id),
			});
			if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

			await assertProjectManager(
				existing.projectId,
				ctx.user.id,
				ctx.membership.role,
			);

			await db.delete(labelTable).where(eq(labelTable.id, input.id));
		}),
});
