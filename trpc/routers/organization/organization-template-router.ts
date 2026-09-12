import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { storageConfig } from "@/config/storage.config";
import { db } from "@/lib/db";
import { recordRevision } from "@/lib/db/revision";
import {
	RevisionAction,
	RevisionEntity,
	TemplateVersionStatus,
} from "@/lib/db/schema/enums";
import {
	buildTable,
	templateTable,
	templateTaskChecklistItemTable,
	templateTaskDependencyTable,
	templateTaskDocumentTable,
	templateTaskTable,
	templateVersionTable,
} from "@/lib/db/schema/manufacturing-tables";
import { assertCanPlan } from "@/lib/manufacturing/permissions";
import {
	ensureDraftVersion,
	getOwnedDraftTask,
	getOwnedDraftVersion,
	getOwnedTemplate,
	getOwnedVersion,
	publishDraftVersion,
	wouldCreateCycle,
} from "@/lib/manufacturing/template-versions";
import { getSignedUploadUrl, getSignedUrl } from "@/lib/storage";
import {
	addTemplateTaskDocumentSchema,
	archiveTemplateSchema,
	createTemplateSchema,
	createTemplateTaskSchema,
	deleteTemplateTaskSchema,
	discardDraftSchema,
	ensureDraftSchema,
	getTemplateSchema,
	getTemplateVersionSchema,
	listTemplatesSchema,
	publishTemplateVersionSchema,
	removeTemplateTaskDocumentSchema,
	reorderTemplateTasksSchema,
	setTemplateTaskChecklistSchema,
	templateTaskDependencySchema,
	templateTaskDocumentUploadUrlSchema,
	updateTemplateSchema,
	updateTemplateTaskSchema,
} from "@/schemas/manufacturing-schemas";
import { createTRPCRouter, protectedOrganizationProcedure } from "@/trpc/init";

function sanitizeFileName(fileName: string): string {
	return fileName.replace(/[^a-zA-Z0-9\-_.]/g, "_").slice(0, 120);
}

export const organizationTemplateRouter = createTRPCRouter({
	// -------------------------------------------------------------------------
	// Templates
	// -------------------------------------------------------------------------

	list: protectedOrganizationProcedure
		.input(listTemplatesSchema)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(templateTable.organizationId, ctx.organization.id),
			];
			if (!input.includeArchived) {
				conditions.push(isNull(templateTable.archivedAt));
			}

			const templates = await db.query.templateTable.findMany({
				where: and(...conditions),
				orderBy: asc(templateTable.name),
				with: {
					versions: {
						orderBy: desc(templateVersionTable.versionNumber),
						columns: {
							id: true,
							versionNumber: true,
							status: true,
							publishedAt: true,
						},
					},
				},
			});

			return templates.map((template) => {
				const draft = template.versions.find(
					(version) => version.status === TemplateVersionStatus.draft,
				);
				const latestPublished = template.versions.find(
					(version) => version.status === TemplateVersionStatus.published,
				);
				return {
					id: template.id,
					name: template.name,
					description: template.description,
					archivedAt: template.archivedAt,
					createdAt: template.createdAt,
					updatedAt: template.updatedAt,
					versionCount: template.versions.length,
					draftVersion: draft ?? null,
					latestPublishedVersion: latestPublished ?? null,
				};
			});
		}),

	get: protectedOrganizationProcedure
		.input(getTemplateSchema)
		.query(async ({ ctx, input }) => {
			const template = await db.query.templateTable.findFirst({
				where: and(
					eq(templateTable.id, input.id),
					eq(templateTable.organizationId, ctx.organization.id),
				),
				with: {
					versions: {
						orderBy: desc(templateVersionTable.versionNumber),
						with: {
							publishedBy: { columns: { id: true, name: true, image: true } },
						},
					},
					products: { columns: { id: true, name: true } },
				},
			});

			if (!template) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Template not found.",
				});
			}

			const versionIds = template.versions.map((version) => version.id);
			const taskCounts =
				versionIds.length > 0
					? await db
							.select({
								versionId: templateTaskTable.versionId,
								count: sql<number>`count(*)::int`,
							})
							.from(templateTaskTable)
							.where(inArray(templateTaskTable.versionId, versionIds))
							.groupBy(templateTaskTable.versionId)
					: [];
			const buildCounts =
				versionIds.length > 0
					? await db
							.select({
								versionId: buildTable.templateVersionId,
								count: sql<number>`count(*)::int`,
							})
							.from(buildTable)
							.where(inArray(buildTable.templateVersionId, versionIds))
							.groupBy(buildTable.templateVersionId)
					: [];

			const taskCountByVersion = new Map(
				taskCounts.map((row) => [row.versionId, row.count]),
			);
			const buildCountByVersion = new Map(
				buildCounts.map((row) => [row.versionId, row.count]),
			);

			return {
				...template,
				versions: template.versions.map((version) => ({
					...version,
					taskCount: taskCountByVersion.get(version.id) ?? 0,
					buildCount: buildCountByVersion.get(version.id) ?? 0,
				})),
			};
		}),

	create: protectedOrganizationProcedure
		.input(createTemplateSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);

			const template = await db.transaction(async (tx) => {
				const [created] = await tx
					.insert(templateTable)
					.values({
						organizationId: ctx.organization.id,
						name: input.name,
						description: input.description || null,
						createdById: ctx.user.id,
					})
					.returning();

				if (!created) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create template.",
					});
				}

				// Every template starts with an empty draft v1.
				await tx.insert(templateVersionTable).values({
					templateId: created.id,
					versionNumber: 1,
					status: TemplateVersionStatus.draft,
					createdById: ctx.user.id,
				});

				return created;
			});

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.template,
				entityId: template.id,
				action: RevisionAction.create,
				changedById: ctx.user.id,
				after: template,
			});

			return template;
		}),

	update: protectedOrganizationProcedure
		.input(updateTemplateSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedTemplate(input.id, ctx.organization.id);

			const [after] = await db
				.update(templateTable)
				.set({
					...(input.name !== undefined ? { name: input.name } : {}),
					...(input.description !== undefined
						? { description: input.description }
						: {}),
				})
				.where(eq(templateTable.id, input.id))
				.returning();

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.template,
				entityId: input.id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
			});

			return after;
		}),

	archive: protectedOrganizationProcedure
		.input(archiveTemplateSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedTemplate(input.id, ctx.organization.id);

			const [after] = await db
				.update(templateTable)
				.set({ archivedAt: input.archived ? new Date() : null })
				.where(eq(templateTable.id, input.id))
				.returning();

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.template,
				entityId: input.id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
				summary: input.archived ? "Archived" : "Unarchived",
			});

			return after;
		}),

	// -------------------------------------------------------------------------
	// Versions
	// -------------------------------------------------------------------------

	getVersion: protectedOrganizationProcedure
		.input(getTemplateVersionSchema)
		.query(async ({ ctx, input }) => {
			const version = await getOwnedVersion(
				input.versionId,
				ctx.organization.id,
			);

			const tasks = await db.query.templateTaskTable.findMany({
				where: eq(templateTaskTable.versionId, version.id),
				orderBy: [
					asc(templateTaskTable.sortOrder),
					asc(templateTaskTable.createdAt),
				],
				with: {
					checklistItems: {
						orderBy: asc(templateTaskChecklistItemTable.sortOrder),
					},
					documents: { orderBy: asc(templateTaskDocumentTable.createdAt) },
					dependencies: {
						columns: { id: true, dependsOnTemplateTaskId: true },
					},
				},
			});

			return { ...version, tasks };
		}),

	ensureDraft: protectedOrganizationProcedure
		.input(ensureDraftSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const result = await ensureDraftVersion({
				templateId: input.templateId,
				organizationId: ctx.organization.id,
				userId: ctx.user.id,
			});

			if (result.created) {
				await recordRevision({
					organizationId: ctx.organization.id,
					entityType: RevisionEntity.templateVersion,
					entityId: result.version.id,
					action: RevisionAction.create,
					changedById: ctx.user.id,
					after: result.version,
					summary: `Draft v${result.version.versionNumber} created`,
				});
			}

			return result.version;
		}),

	publish: protectedOrganizationProcedure
		.input(publishTemplateVersionSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const published = await publishDraftVersion({
				versionId: input.versionId,
				organizationId: ctx.organization.id,
				userId: ctx.user.id,
				changeNote: input.changeNote,
			});

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.templateVersion,
				entityId: published.id,
				action: RevisionAction.publish,
				changedById: ctx.user.id,
				after: published,
				summary: `Published v${published.versionNumber}`,
			});

			return published;
		}),

	discardDraft: protectedOrganizationProcedure
		.input(discardDraftSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const draft = await getOwnedDraftVersion(
				input.versionId,
				ctx.organization.id,
			);

			// Never delete the only version of a template; empty it instead.
			const versionCount = await db.$count(
				templateVersionTable,
				eq(templateVersionTable.templateId, draft.templateId),
			);

			if (versionCount <= 1) {
				await db
					.delete(templateTaskTable)
					.where(eq(templateTaskTable.versionId, draft.id));
			} else {
				await db
					.delete(templateVersionTable)
					.where(eq(templateVersionTable.id, draft.id));
			}

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.templateVersion,
				entityId: draft.id,
				action: RevisionAction.delete,
				changedById: ctx.user.id,
				before: draft,
				summary: `Draft v${draft.versionNumber} discarded`,
			});

			return { success: true };
		}),

	// -------------------------------------------------------------------------
	// Tasks (draft only)
	// -------------------------------------------------------------------------

	createTask: protectedOrganizationProcedure
		.input(createTemplateTaskSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const draft = await getOwnedDraftVersion(
				input.versionId,
				ctx.organization.id,
			);

			const [sortRow] = await db
				.select({ maxSort: sql<number>`coalesce(max(sort_order), -1)::int` })
				.from(templateTaskTable)
				.where(eq(templateTaskTable.versionId, draft.id));
			const maxSort = sortRow?.maxSort ?? -1;

			const task = await db.transaction(async (tx) => {
				const [created] = await tx
					.insert(templateTaskTable)
					.values({
						versionId: draft.id,
						title: input.title,
						instructions: input.instructions ?? null,
						phase: input.phase ?? null,
						sortOrder: maxSort + 1,
						durationDays: input.durationDays,
						requiresPhoto: input.requiresPhoto,
						requiresComment: input.requiresComment,
					})
					.returning();

				if (!created) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create task.",
					});
				}

				if (input.checklistItems.length > 0) {
					await tx.insert(templateTaskChecklistItemTable).values(
						input.checklistItems.map((title, index) => ({
							templateTaskId: created.id,
							title,
							sortOrder: index,
						})),
					);
				}

				return created;
			});

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.templateTask,
				entityId: task.id,
				action: RevisionAction.create,
				changedById: ctx.user.id,
				after: task,
			});

			return task;
		}),

	updateTask: protectedOrganizationProcedure
		.input(updateTemplateTaskSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedDraftTask(input.id, ctx.organization.id);

			const { id, ...changes } = input;
			const [after] = await db
				.update(templateTaskTable)
				.set(
					Object.fromEntries(
						Object.entries(changes).filter(([, value]) => value !== undefined),
					),
				)
				.where(eq(templateTaskTable.id, id))
				.returning();

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.templateTask,
				entityId: id,
				action: RevisionAction.update,
				changedById: ctx.user.id,
				before,
				after,
			});

			return after;
		}),

	deleteTask: protectedOrganizationProcedure
		.input(deleteTemplateTaskSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const before = await getOwnedDraftTask(input.id, ctx.organization.id);

			await db
				.delete(templateTaskTable)
				.where(eq(templateTaskTable.id, input.id));

			await recordRevision({
				organizationId: ctx.organization.id,
				entityType: RevisionEntity.templateTask,
				entityId: input.id,
				action: RevisionAction.delete,
				changedById: ctx.user.id,
				before,
			});

			return { success: true };
		}),

	reorderTasks: protectedOrganizationProcedure
		.input(reorderTemplateTasksSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const draft = await getOwnedDraftVersion(
				input.versionId,
				ctx.organization.id,
			);

			const existing = await db.query.templateTaskTable.findMany({
				where: eq(templateTaskTable.versionId, draft.id),
				columns: { id: true },
			});
			const existingIds = new Set(existing.map((task) => task.id));
			const unknown = input.orderedTaskIds.filter((id) => !existingIds.has(id));
			if (unknown.length > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Ordered task ids do not belong to this version.",
				});
			}

			await db.transaction(async (tx) => {
				for (const [index, taskId] of input.orderedTaskIds.entries()) {
					await tx
						.update(templateTaskTable)
						.set({ sortOrder: index })
						.where(eq(templateTaskTable.id, taskId));
				}
			});

			return { success: true };
		}),

	setChecklist: protectedOrganizationProcedure
		.input(setTemplateTaskChecklistSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			await getOwnedDraftTask(input.templateTaskId, ctx.organization.id);

			await db.transaction(async (tx) => {
				const keepIds = input.items
					.map((item) => item.id)
					.filter((id): id is string => Boolean(id));

				const existing = await tx.query.templateTaskChecklistItemTable.findMany(
					{
						where: eq(
							templateTaskChecklistItemTable.templateTaskId,
							input.templateTaskId,
						),
						columns: { id: true },
					},
				);
				const toDelete = existing
					.map((item) => item.id)
					.filter((id) => !keepIds.includes(id));
				if (toDelete.length > 0) {
					await tx
						.delete(templateTaskChecklistItemTable)
						.where(inArray(templateTaskChecklistItemTable.id, toDelete));
				}

				for (const [index, item] of input.items.entries()) {
					if (item.id) {
						await tx
							.update(templateTaskChecklistItemTable)
							.set({ title: item.title, sortOrder: index })
							.where(
								and(
									eq(templateTaskChecklistItemTable.id, item.id),
									eq(
										templateTaskChecklistItemTable.templateTaskId,
										input.templateTaskId,
									),
								),
							);
					} else {
						await tx.insert(templateTaskChecklistItemTable).values({
							templateTaskId: input.templateTaskId,
							title: item.title,
							sortOrder: index,
						});
					}
				}
			});

			return db.query.templateTaskChecklistItemTable.findMany({
				where: eq(
					templateTaskChecklistItemTable.templateTaskId,
					input.templateTaskId,
				),
				orderBy: asc(templateTaskChecklistItemTable.sortOrder),
			});
		}),

	addDependency: protectedOrganizationProcedure
		.input(templateTaskDependencySchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			const task = await getOwnedDraftTask(
				input.templateTaskId,
				ctx.organization.id,
			);
			const dependsOn = await getOwnedDraftTask(
				input.dependsOnTemplateTaskId,
				ctx.organization.id,
			);

			if (task.versionId !== dependsOn.versionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Both tasks must belong to the same template version.",
				});
			}

			if (
				await wouldCreateCycle(
					task.versionId,
					input.templateTaskId,
					input.dependsOnTemplateTaskId,
				)
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This dependency would create a cycle.",
				});
			}

			await db
				.insert(templateTaskDependencyTable)
				.values({
					templateTaskId: input.templateTaskId,
					dependsOnTemplateTaskId: input.dependsOnTemplateTaskId,
				})
				.onConflictDoNothing();

			return { success: true };
		}),

	removeDependency: protectedOrganizationProcedure
		.input(templateTaskDependencySchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			await getOwnedDraftTask(input.templateTaskId, ctx.organization.id);

			await db
				.delete(templateTaskDependencyTable)
				.where(
					and(
						eq(
							templateTaskDependencyTable.templateTaskId,
							input.templateTaskId,
						),
						eq(
							templateTaskDependencyTable.dependsOnTemplateTaskId,
							input.dependsOnTemplateTaskId,
						),
					),
				);

			return { success: true };
		}),

	// -------------------------------------------------------------------------
	// Documents (draft only)
	// -------------------------------------------------------------------------

	documentUploadUrl: protectedOrganizationProcedure
		.input(templateTaskDocumentUploadUrlSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			await getOwnedDraftTask(input.templateTaskId, ctx.organization.id);

			const storageKey = `orgs/${ctx.organization.id}/template-docs/${input.templateTaskId}/${crypto.randomUUID()}-${sanitizeFileName(input.fileName)}`;
			const signedUrl = await getSignedUploadUrl(
				storageKey,
				storageConfig.bucketNames.images,
				input.contentType ?? "application/octet-stream",
			);

			return { storageKey, signedUrl };
		}),

	addDocument: protectedOrganizationProcedure
		.input(addTemplateTaskDocumentSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);
			await getOwnedDraftTask(input.templateTaskId, ctx.organization.id);

			if (!input.storageKey.startsWith(`orgs/${ctx.organization.id}/`)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid storage key.",
				});
			}

			const [document] = await db
				.insert(templateTaskDocumentTable)
				.values({
					templateTaskId: input.templateTaskId,
					uploadedById: ctx.user.id,
					storageKey: input.storageKey,
					fileName: input.fileName,
					contentType: input.contentType ?? null,
					sizeBytes: input.sizeBytes ?? null,
				})
				.returning();

			return document;
		}),

	removeDocument: protectedOrganizationProcedure
		.input(removeTemplateTaskDocumentSchema)
		.mutation(async ({ ctx, input }) => {
			assertCanPlan(ctx.membership.role);

			const document = await db.query.templateTaskDocumentTable.findFirst({
				where: eq(templateTaskDocumentTable.id, input.id),
				columns: { id: true, templateTaskId: true },
			});
			if (!document) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Document not found.",
				});
			}
			await getOwnedDraftTask(document.templateTaskId, ctx.organization.id);

			await db
				.delete(templateTaskDocumentTable)
				.where(eq(templateTaskDocumentTable.id, input.id));

			return { success: true };
		}),

	documentDownloadUrl: protectedOrganizationProcedure
		.input(removeTemplateTaskDocumentSchema)
		.query(async ({ ctx, input }) => {
			const document = await db.query.templateTaskDocumentTable.findFirst({
				where: eq(templateTaskDocumentTable.id, input.id),
				with: {
					templateTask: {
						with: { version: { with: { template: true } } },
					},
				},
			});

			if (
				!document ||
				document.templateTask.version.template.organizationId !==
					ctx.organization.id
			) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Document not found.",
				});
			}

			const url = await getSignedUrl(
				document.storageKey,
				storageConfig.bucketNames.images,
				60 * 10,
			);

			return { url, fileName: document.fileName };
		}),
});
