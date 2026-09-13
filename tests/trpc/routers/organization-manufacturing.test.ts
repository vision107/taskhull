import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildTable,
	buildTaskActivityTable,
	db,
	memberTable,
	notificationTable,
	organizationTable,
	productTable,
	revisionTable,
	templateTable,
	userTable,
} from "@/lib/db";
import { MemberRole } from "@/lib/db/schema/enums";
import { createTestTRPCContext } from "@/tests/support/trpc-utils";
import { createCallerFactory } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/app";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = "a1111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "a2222222-2222-4222-8222-222222222222";

const PLANNER_ID = "b1111111-1111-4111-8111-111111111111";
const WORKER_ID = "b2222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "b3333333-3333-4333-8333-333333333333";

function makeUser(id: string, name: string, email: string) {
	return {
		id,
		email,
		name,
		role: "user" as const,
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		image: null,
		username: name.toLowerCase(),
		banned: false,
		banReason: null,
		banExpires: null,
		onboardingComplete: true,
		twoFactorEnabled: false,
	};
}

const planner = makeUser(PLANNER_ID, "Planner", "planner@example.com");
const worker = makeUser(WORKER_ID, "Worker", "worker@example.com");
const outsider = makeUser(OUTSIDER_ID, "Outsider", "outsider@example.com");

// Mutable auth state the mocks read from so each test can switch actor.
const authState = {
	user: planner,
	organizationId: ORG_ID as string,
	membershipRole: MemberRole.owner as MemberRole,
};

vi.mock("next/headers", () => ({
	headers: () => new Headers(),
}));

vi.mock("@/lib/auth/server", () => ({
	getSession: async () => ({
		user: authState.user,
		session: {
			id: "test-session-id",
			userId: authState.user.id,
			expiresAt: new Date(Date.now() + 1000 * 60 * 60),
			activeOrganizationId: authState.organizationId,
			token: "test-token",
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: null,
			userAgent: null,
			impersonatedBy: null,
		},
	}),
	assertUserIsOrgMember: async (organizationId: string, userId: string) => {
		const org = await db.query.organizationTable.findFirst({
			where: (t, { eq }) => eq(t.id, organizationId),
		});
		const membership = await db.query.memberTable.findFirst({
			where: (t, { and, eq }) =>
				and(eq(t.organizationId, organizationId), eq(t.userId, userId)),
		});
		if (!(org && membership)) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
		}
		return { organization: org, membership };
	},
}));

vi.mock("@/lib/storage", () => ({
	getSignedUploadUrl: async (path: string) => `https://upload.test/${path}`,
	getSignedUrl: async (path: string) => `https://download.test/${path}`,
}));

/**
 * The shared harness truncates the per-worker schema, but the base migrations
 * create tables in `public`, so rows survive between tests. Reset the
 * manufacturing tables ourselves (templates/products cascade to everything
 * below them) and seed users/orgs idempotently.
 */
async function seed() {
	await db.delete(notificationTable);
	await db.delete(buildTaskActivityTable);
	await db.delete(revisionTable);
	await db.delete(buildTable);
	await db.delete(productTable);
	await db.delete(templateTable);

	await db
		.insert(userTable)
		.values(
			[planner, worker, outsider].map((u) => ({
				id: u.id,
				email: u.email,
				name: u.name,
				emailVerified: true,
				image: null,
				username: u.username,
				role: "user" as const,
				banned: false,
				banReason: null,
				banExpires: null,
				onboardingComplete: true,
			})),
		)
		.onConflictDoNothing();

	await db
		.insert(organizationTable)
		.values([
			{ id: ORG_ID, name: "Test Org", slug: "test-org" },
			{ id: OTHER_ORG_ID, name: "Other Org", slug: "other-org" },
		])
		.onConflictDoNothing();

	await db
		.insert(memberTable)
		.values([
			{ organizationId: ORG_ID, userId: PLANNER_ID, role: MemberRole.owner },
			{ organizationId: ORG_ID, userId: WORKER_ID, role: MemberRole.member },
			{
				organizationId: OTHER_ORG_ID,
				userId: OUTSIDER_ID,
				role: MemberRole.owner,
			},
		])
		.onConflictDoNothing();
}

function callerAs(
	user: typeof planner,
	organizationId: string = ORG_ID,
	role: MemberRole = MemberRole.owner,
) {
	authState.user = user;
	authState.organizationId = organizationId;
	authState.membershipRole = role;
	return createCallerFactory(appRouter)(createTestTRPCContext(user));
}

/**
 * Build a published template with three tasks:
 *   Frame (2d) ─┐
 *               ├─> Wiring (1d) ─> Test (1d)
 *   Cabinet (3d)┘
 * Returns ids.
 */
async function createPublishedTemplate(
	caller: ReturnType<typeof callerAs>,
	name = "Machine XY",
) {
	const template = await caller.organization.template.create({ name });
	const detail = await caller.organization.template.get({ id: template.id });
	const draft = detail.versions.find((v) => v.status === "draft")!;

	const frame = await caller.organization.template.createTask({
		versionId: draft.id,
		title: "Mount frame",
		phase: "Mechanics",
		durationDays: 2,
		checklistItems: ["Check bolts", "Level base"],
	});
	const cabinet = await caller.organization.template.createTask({
		versionId: draft.id,
		title: "Assemble cabinet",
		phase: "Mechanics",
		durationDays: 3,
	});
	const wiring = await caller.organization.template.createTask({
		versionId: draft.id,
		title: "Wire control cabinet",
		phase: "Electrics",
		durationDays: 1,
		requiresPhoto: true,
	});
	const test = await caller.organization.template.createTask({
		versionId: draft.id,
		title: "Function test",
		phase: "QA",
		durationDays: 1,
		requiresComment: true,
	});

	await caller.organization.template.addDependency({
		templateTaskId: wiring.id,
		dependsOnTemplateTaskId: frame.id,
	});
	await caller.organization.template.addDependency({
		templateTaskId: wiring.id,
		dependsOnTemplateTaskId: cabinet.id,
	});
	await caller.organization.template.addDependency({
		templateTaskId: test.id,
		dependsOnTemplateTaskId: wiring.id,
	});

	const published = await caller.organization.template.publish({
		versionId: draft.id,
		changeNote: "Initial release",
	});

	return {
		template,
		version: published,
		tasks: { frame, cabinet, wiring, test },
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("manufacturing routers", () => {
	beforeEach(async () => {
		await seed();
	});

	describe("templates & versions", () => {
		it("creates a template with an empty draft v1", async () => {
			const caller = callerAs(planner);
			const template = await caller.organization.template.create({
				name: "Machine XY",
			});
			const detail = await caller.organization.template.get({
				id: template.id,
			});

			expect(detail.versions).toHaveLength(1);
			expect(detail.versions[0]).toMatchObject({
				versionNumber: 1,
				status: "draft",
				taskCount: 0,
			});
		});

		it("refuses to publish an empty draft", async () => {
			const caller = callerAs(planner);
			const template = await caller.organization.template.create({
				name: "Empty",
			});
			const detail = await caller.organization.template.get({
				id: template.id,
			});

			await expect(
				caller.organization.template.publish({
					versionId: detail.versions[0]!.id,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("publishes a draft and makes it immutable", async () => {
			const caller = callerAs(planner);
			const { version, tasks } = await createPublishedTemplate(caller);

			expect(version.status).toBe("published");
			expect(version.publishedAt).toBeInstanceOf(Date);
			expect(version.publishedById).toBe(PLANNER_ID);

			await expect(
				caller.organization.template.updateTask({
					id: tasks.frame.id,
					title: "Changed",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			await expect(
				caller.organization.template.createTask({
					versionId: version.id,
					title: "New task",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("rejects dependency cycles", async () => {
			const caller = callerAs(planner);
			const template = await caller.organization.template.create({
				name: "Cyclic",
			});
			const detail = await caller.organization.template.get({
				id: template.id,
			});
			const draftId = detail.versions[0]!.id;

			const a = await caller.organization.template.createTask({
				versionId: draftId,
				title: "A",
			});
			const b = await caller.organization.template.createTask({
				versionId: draftId,
				title: "B",
			});

			await caller.organization.template.addDependency({
				templateTaskId: b.id,
				dependsOnTemplateTaskId: a.id,
			});
			await expect(
				caller.organization.template.addDependency({
					templateTaskId: a.id,
					dependsOnTemplateTaskId: b.id,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				caller.organization.template.addDependency({
					templateTaskId: a.id,
					dependsOnTemplateTaskId: a.id,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("ensureDraft creates v2 as a deep copy of the published version", async () => {
			const caller = callerAs(planner);
			const { template, version, tasks } =
				await createPublishedTemplate(caller);

			const draft = await caller.organization.template.ensureDraft({
				templateId: template.id,
			});
			expect(draft.versionNumber).toBe(2);
			expect(draft.status).toBe("draft");

			// Calling again returns the same draft.
			const again = await caller.organization.template.ensureDraft({
				templateId: template.id,
			});
			expect(again.id).toBe(draft.id);

			const v2 = await caller.organization.template.getVersion({
				versionId: draft.id,
			});
			expect(v2.tasks).toHaveLength(4);
			expect(v2.tasks.map((t) => t.title)).toEqual([
				"Mount frame",
				"Assemble cabinet",
				"Wire control cabinet",
				"Function test",
			]);

			// Copied tasks have new ids and their own checklist/dependencies.
			const copiedFrame = v2.tasks.find((t) => t.title === "Mount frame")!;
			expect(copiedFrame.id).not.toBe(tasks.frame.id);
			expect(copiedFrame.checklistItems.map((c) => c.title)).toEqual([
				"Check bolts",
				"Level base",
			]);

			const copiedWiring = v2.tasks.find(
				(t) => t.title === "Wire control cabinet",
			)!;
			expect(copiedWiring.dependencies).toHaveLength(2);
			const depIds = copiedWiring.dependencies.map(
				(d) => d.dependsOnTemplateTaskId,
			);
			const v2Ids = new Set(v2.tasks.map((t) => t.id));
			for (const id of depIds) expect(v2Ids.has(id)).toBe(true);

			// Editing v2 does not touch v1.
			await caller.organization.template.updateTask({
				id: copiedFrame.id,
				title: "Mount frame (improved)",
			});
			const v1 = await caller.organization.template.getVersion({
				versionId: version.id,
			});
			expect(v1.tasks.find((t) => t.id === tasks.frame.id)?.title).toBe(
				"Mount frame",
			);
		});

		it("forbids members (workers) from editing templates", async () => {
			const caller = callerAs(worker, ORG_ID, MemberRole.member);
			await expect(
				caller.organization.template.create({ name: "Nope" }),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("isolates templates between organizations", async () => {
			const plannerCaller = callerAs(planner);
			const { template } = await createPublishedTemplate(plannerCaller);

			const outsiderCaller = callerAs(outsider, OTHER_ORG_ID);
			await expect(
				outsiderCaller.organization.template.get({ id: template.id }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			const list = await outsiderCaller.organization.template.list({});
			expect(list).toHaveLength(0);
		});
	});

	describe("products & builds", () => {
		it("creates a build from the latest published version with scheduled tasks", async () => {
			const caller = callerAs(planner);
			const { template, version } = await createPublishedTemplate(caller);

			const product = await caller.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});

			const build = await caller.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});

			expect(build.templateVersionId).toBe(version.id);
			expect(build.status).toBe("planned");
			// frame 2d / cabinet 3d in parallel -> wiring starts day 3 (+1) -> test (+1)
			expect(build.plannedEndDate).toBe("2026-10-06");

			const detail = await caller.organization.build.get({ id: build.id });
			expect(detail.tasks).toHaveLength(4);

			const wiring = detail.tasks.find(
				(t) => t.title === "Wire control cabinet",
			)!;
			expect(wiring.startDate).toBe("2026-10-04");
			expect(wiring.endDate).toBe("2026-10-05");
			expect(wiring.requiresPhoto).toBe(true);
			expect(wiring.dependencies).toHaveLength(2);
			expect(wiring.assignments).toHaveLength(0);

			const frame = detail.tasks.find((t) => t.title === "Mount frame")!;
			expect(frame.checklistTotalCount).toBe(2);
		});

		it("lets a planner add, edit and delete ad-hoc tasks with dependencies", async () => {
			const caller = callerAs(planner);
			const { template } = await createPublishedTemplate(caller);
			const product = await caller.organization.product.create({
				name: "Machine AD",
				templateId: template.id,
			});
			const build = await caller.organization.build.create({
				productId: product.id,
				serialNumber: "AD-0001",
				plannedStartDate: "2026-10-01",
			});
			const detail = await caller.organization.build.get({ id: build.id });
			const wiring = detail.tasks.find(
				(t) => t.title === "Wire control cabinet",
			)!;

			// No explicit start -> scheduled after the dependency (wiring ends 10-05).
			const extra = await caller.organization.build.createTask({
				buildId: build.id,
				title: "Label cable ducts",
				phase: "Electrics",
				plannedDurationDays: 2,
				dependsOnIds: [wiring.id],
			});
			expect(extra.sourceTemplateTaskId).toBeNull();
			expect(extra.startDate).toBe("2026-10-05");
			expect(extra.endDate).toBe("2026-10-07");

			// Duration change recomputes the end date; dependencies are replaced.
			const frame = detail.tasks.find((t) => t.title === "Mount frame")!;
			const edited = await caller.organization.build.updateTask({
				id: extra.id,
				plannedDurationDays: 4,
				dependsOnIds: [frame.id],
			});
			expect(edited?.endDate).toBe("2026-10-09");
			const after = await caller.organization.build.get({ id: build.id });
			const extraAfter = after.tasks.find((t) => t.id === extra.id)!;
			expect(
				extraAfter.dependencies.map((d) => d.dependsOnBuildTaskId),
			).toEqual([frame.id]);

			// A loop (wiring -> extra while extra -> frame -> ... ) is rejected.
			await expect(
				caller.organization.build.updateTask({
					id: frame.id,
					dependsOnIds: [extra.id],
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				caller.organization.build.updateTask({
					id: extra.id,
					dependsOnIds: [extra.id],
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			// Dependencies must come from the same build.
			const other = await caller.organization.build.create({
				productId: product.id,
				serialNumber: "AD-0002",
				plannedStartDate: "2026-10-01",
			});
			const otherDetail = await caller.organization.build.get({ id: other.id });
			await expect(
				caller.organization.build.createTask({
					buildId: build.id,
					title: "Cross-build",
					dependsOnIds: [otherDetail.tasks[0]!.id],
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			await caller.organization.build.deleteTask({ id: extra.id });
			const finalDetail = await caller.organization.build.get({ id: build.id });
			expect(finalDetail.tasks.some((t) => t.id === extra.id)).toBe(false);

			// Workers cannot add tasks.
			await expect(
				callerAs(worker).organization.build.createTask({
					buildId: build.id,
					title: "Nope",
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("refuses a build when the template has no published version", async () => {
			const caller = callerAs(planner);
			const template = await caller.organization.template.create({
				name: "Unpublished",
			});
			const product = await caller.organization.product.create({
				name: "P",
				templateId: template.id,
			});

			await expect(
				caller.organization.build.create({
					productId: product.id,
					serialNumber: "P-1",
					plannedStartDate: "2026-10-01",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("rejects duplicate serial numbers per product", async () => {
			const caller = callerAs(planner);
			const { template } = await createPublishedTemplate(caller);
			const product = await caller.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});

			await caller.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});
			await expect(
				caller.organization.build.create({
					productId: product.id,
					serialNumber: "XY-0001",
					plannedStartDate: "2026-10-08",
				}),
			).rejects.toMatchObject({ code: "CONFLICT" });
		});

		it("pins existing builds to their version when a new one is published", async () => {
			const caller = callerAs(planner);
			const { template, version: v1 } = await createPublishedTemplate(caller);
			const product = await caller.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});
			const oldBuild = await caller.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});

			// Improve the template: v2 adds a task.
			const draft = await caller.organization.template.ensureDraft({
				templateId: template.id,
			});
			await caller.organization.template.createTask({
				versionId: draft.id,
				title: "Apply safety labels",
				phase: "QA",
			});
			const v2 = await caller.organization.template.publish({
				versionId: draft.id,
				changeNote: "Added safety labels",
			});

			const newBuild = await caller.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0002",
				plannedStartDate: "2026-10-08",
			});

			expect(oldBuild.templateVersionId).toBe(v1.id);
			expect(newBuild.templateVersionId).toBe(v2.id);

			const oldDetail = await caller.organization.build.get({
				id: oldBuild.id,
			});
			const newDetail = await caller.organization.build.get({
				id: newBuild.id,
			});
			expect(oldDetail.tasks).toHaveLength(4);
			expect(newDetail.tasks).toHaveLength(5);
		});
	});

	describe("cross-build assignment & worker flow", () => {
		it("assigns the same task across several builds and the worker sees them all", async () => {
			const plannerCaller = callerAs(planner);
			const { template } = await createPublishedTemplate(plannerCaller);
			const product = await plannerCaller.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});

			// Four units this month.
			for (let i = 1; i <= 4; i++) {
				await plannerCaller.organization.build.create({
					productId: product.id,
					serialNumber: `XY-000${i}`,
					plannedStartDate: `2026-10-0${i}`,
				});
			}

			const grid = await plannerCaller.organization.build.assignmentGrid({
				templateId: template.id,
			});
			expect(grid.builds).toHaveLength(4);
			expect(grid.rows).toHaveLength(4);

			const wiringRow = grid.rows.find(
				(row) => row.title === "Wire control cabinet",
			)!;
			const wiringTaskIds = Object.values(wiringRow.cells)
				.filter((cell): cell is NonNullable<typeof cell> => cell !== null)
				.map((cell) => cell.id);
			expect(wiringTaskIds).toHaveLength(4);

			const result = await plannerCaller.organization.build.assign({
				buildTaskIds: wiringTaskIds,
				userId: WORKER_ID,
			});
			expect(result.assigned).toBe(4);

			// Worker's todo list.
			const workerCaller = callerAs(worker, ORG_ID, MemberRole.member);
			const myTasks = await workerCaller.organization.work.myTasks({});
			expect(myTasks).toHaveLength(4);
			expect(new Set(myTasks.map((t) => t.title))).toEqual(
				new Set(["Wire control cabinet"]),
			);
			expect(myTasks.map((t) => t.build.serialNumber).sort()).toEqual([
				"XY-0001",
				"XY-0002",
				"XY-0003",
				"XY-0004",
			]);
			expect(myTasks[0]!.build.templateVersion?.template.name).toBe(
				"Machine XY",
			);
			// Wiring depends on frame + cabinet, which are still todo.
			expect(myTasks[0]!.openBlockers).toHaveLength(2);

			// Planner sees nothing in their own list.
			const plannerTasks = await callerAs(planner).organization.work.myTasks(
				{},
			);
			expect(plannerTasks).toHaveLength(0);
		});

		it("enforces blockers, photo/comment requirements and status transitions", async () => {
			const plannerCaller = callerAs(planner);
			const { template } = await createPublishedTemplate(plannerCaller);
			const product = await plannerCaller.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});
			const build = await plannerCaller.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});
			const detail = await plannerCaller.organization.build.get({
				id: build.id,
			});
			const byTitle = Object.fromEntries(detail.tasks.map((t) => [t.title, t]));

			await plannerCaller.organization.build.assign({
				buildTaskIds: [
					byTitle["Mount frame"]!.id,
					byTitle["Assemble cabinet"]!.id,
					byTitle["Wire control cabinet"]!.id,
				],
				userId: WORKER_ID,
			});

			const workerCaller = callerAs(worker, ORG_ID, MemberRole.member);

			// Not assigned to "Function test".
			await expect(
				workerCaller.organization.work.updateStatus({
					id: byTitle["Function test"]!.id,
					status: "in_progress",
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });

			// Cannot finish wiring while frame/cabinet are open.
			await workerCaller.organization.work.updateStatus({
				id: byTitle["Wire control cabinet"]!.id,
				status: "in_progress",
			});
			await expect(
				workerCaller.organization.work.updateStatus({
					id: byTitle["Wire control cabinet"]!.id,
					status: "done",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			// Finish the blockers (todo -> done is not a direct transition).
			for (const title of ["Mount frame", "Assemble cabinet"]) {
				await expect(
					workerCaller.organization.work.updateStatus({
						id: byTitle[title]!.id,
						status: "done",
					}),
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
				await workerCaller.organization.work.updateStatus({
					id: byTitle[title]!.id,
					status: "in_progress",
				});
				await workerCaller.organization.work.updateStatus({
					id: byTitle[title]!.id,
					status: "done",
				});
			}

			// Wiring requires a photo.
			await expect(
				workerCaller.organization.work.updateStatus({
					id: byTitle["Wire control cabinet"]!.id,
					status: "done",
				}),
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: expect.stringContaining("photo"),
			});

			// Upload guardrails: type and size are checked before signing.
			await expect(
				workerCaller.organization.work.attachmentUploadUrl({
					buildTaskId: byTitle["Wire control cabinet"]!.id,
					fileName: "clip.mp4",
					contentType: "video/mp4",
					sizeBytes: 1024,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				workerCaller.organization.work.attachmentUploadUrl({
					buildTaskId: byTitle["Wire control cabinet"]!.id,
					fileName: "huge.jpg",
					contentType: "image/jpeg",
					sizeBytes: 16 * 1024 * 1024,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			const upload = await workerCaller.organization.work.attachmentUploadUrl({
				buildTaskId: byTitle["Wire control cabinet"]!.id,
				fileName: "cabinet done.jpg",
				contentType: "image/jpeg",
				sizeBytes: 250_000,
			});
			expect(upload.storageKey.startsWith(`orgs/${ORG_ID}/builds/`)).toBe(true);
			await workerCaller.organization.work.addAttachment({
				buildTaskId: byTitle["Wire control cabinet"]!.id,
				storageKey: upload.storageKey,
				fileName: "cabinet done.jpg",
				contentType: "image/jpeg",
				sizeBytes: 250_000,
			});
			await workerCaller.organization.work.addComment({
				buildTaskId: byTitle["Wire control cabinet"]!.id,
				body: "Used the new cable ties.",
			});

			const done = await workerCaller.organization.work.updateStatus({
				id: byTitle["Wire control cabinet"]!.id,
				status: "done",
			});
			expect(done.status).toBe("done");
			expect(done.completedById).toBe(WORKER_ID);

			// Build status followed along.
			const buildAfter = await plannerCaller.organization.build.get({
				id: build.id,
			});
			expect(buildAfter.status).toBe("active");
			expect(buildAfter.actualStartedAt).toBeInstanceOf(Date);

			// Worker's task detail exposes uploads, comments and documents separately.
			const taskDetail = await workerCaller.organization.work.getTask({
				id: byTitle["Wire control cabinet"]!.id,
			});
			expect(taskDetail.uploads).toHaveLength(1);
			expect(taskDetail.documents).toHaveLength(0);
			expect(taskDetail.comments).toHaveLength(1);
			expect(taskDetail.isAssigned).toBe(true);

			// Activity was recorded.
			const activity = await plannerCaller.organization.work.activity({
				buildId: build.id,
			});
			expect(activity.map((a) => a.action)).toEqual(
				expect.arrayContaining([
					"build.created",
					"task.assigned",
					"task.status_changed",
					"task.commented",
					"task.attachment_added",
				]),
			);
		});

		it("completes the build when every task is done", async () => {
			const plannerCaller = callerAs(planner);
			const template = await plannerCaller.organization.template.create({
				name: "Tiny",
			});
			const detail = await plannerCaller.organization.template.get({
				id: template.id,
			});
			await plannerCaller.organization.template.createTask({
				versionId: detail.versions[0]!.id,
				title: "Only task",
			});
			await plannerCaller.organization.template.publish({
				versionId: detail.versions[0]!.id,
			});
			const product = await plannerCaller.organization.product.create({
				name: "Tiny",
				templateId: template.id,
			});
			const build = await plannerCaller.organization.build.create({
				productId: product.id,
				serialNumber: "T-1",
				plannedStartDate: "2026-10-01",
			});
			const buildDetail = await plannerCaller.organization.build.get({
				id: build.id,
			});
			const taskId = buildDetail.tasks[0]!.id;

			// Planner may skip transitions.
			await plannerCaller.organization.work.updateStatus({
				id: taskId,
				status: "done",
			});

			const after = await plannerCaller.organization.build.get({
				id: build.id,
			});
			expect(after.status).toBe("completed");
			expect(after.actualCompletedAt).toBeInstanceOf(Date);
		});

		it("does not let an outsider see or touch another organization's tasks", async () => {
			const plannerCaller = callerAs(planner);
			const { template } = await createPublishedTemplate(plannerCaller);
			const product = await plannerCaller.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});
			const build = await plannerCaller.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});
			const detail = await plannerCaller.organization.build.get({
				id: build.id,
			});

			const outsiderCaller = callerAs(outsider, OTHER_ORG_ID);
			await expect(
				outsiderCaller.organization.build.get({ id: build.id }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				outsiderCaller.organization.work.getTask({ id: detail.tasks[0]!.id }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			// Outsider is a valid member of *their* org, so the membership check
			// passes and the tenant check on the tasks must be what rejects.
			await expect(
				outsiderCaller.organization.build.assign({
					buildTaskIds: [detail.tasks[0]!.id],
					userId: OUTSIDER_ID,
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			// And assigning a non-member of the org is rejected up front.
			await expect(
				callerAs(planner).organization.build.assign({
					buildTaskIds: [detail.tasks[0]!.id],
					userId: OUTSIDER_ID,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
	});

	describe("template upgrades & notifications", () => {
		it("upgrades an open build to a newer version while keeping progress", async () => {
			const plannerCaller = callerAs(planner);
			const { template, tasks } = await createPublishedTemplate(plannerCaller);
			const product = await plannerCaller.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});
			const build = await plannerCaller.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});

			// Worker finishes the frame and starts the cabinet before v2 lands.
			let detail = await plannerCaller.organization.build.get({ id: build.id });
			expect(detail.availableUpgrades).toHaveLength(0);
			const byTitle = Object.fromEntries(detail.tasks.map((t) => [t.title, t]));
			await plannerCaller.organization.build.assign({
				buildTaskIds: [
					byTitle["Mount frame"]!.id,
					byTitle["Assemble cabinet"]!.id,
				],
				userId: WORKER_ID,
			});
			const workerCaller = callerAs(worker, ORG_ID, MemberRole.member);
			await workerCaller.organization.work.updateStatus({
				id: byTitle["Mount frame"]!.id,
				status: "in_progress",
			});
			await workerCaller.organization.work.updateStatus({
				id: byTitle["Mount frame"]!.id,
				status: "done",
			});
			await workerCaller.organization.work.updateStatus({
				id: byTitle["Assemble cabinet"]!.id,
				status: "in_progress",
			});
			await workerCaller.organization.work.addComment({
				buildTaskId: byTitle["Assemble cabinet"]!.id,
				body: "Halfway there",
			});

			// Planner improves the template: rename wiring, add a new checklist
			// item, drop "Function test", add "Paint".
			const c = callerAs(planner);
			const draft = await c.organization.template.ensureDraft({
				templateId: template.id,
			});
			const draftDetail = await c.organization.template.getVersion({
				versionId: draft.id,
			});
			const draftByTitle = Object.fromEntries(
				draftDetail.tasks.map((t) => [t.title, t]),
			);
			await c.organization.template.updateTask({
				id: draftByTitle["Wire control cabinet"]!.id,
				title: "Wire control cabinet (rev B)",
				durationDays: 2,
			});
			await c.organization.template.setChecklist({
				templateTaskId: draftByTitle["Mount frame"]!.id,
				items: [
					{ title: "Check bolts" },
					{ title: "Level base" },
					{ title: "Torque to spec" },
				],
			});
			await c.organization.template.deleteTask({
				id: draftByTitle["Function test"]!.id,
			});
			const paint = await c.organization.template.createTask({
				versionId: draft.id,
				title: "Paint",
				phase: "Finish",
				durationDays: 1,
			});
			await c.organization.template.addDependency({
				templateTaskId: paint.id,
				dependsOnTemplateTaskId: draftByTitle["Wire control cabinet"]!.id,
			});
			const v2 = await c.organization.template.publish({
				versionId: draft.id,
				changeNote: "Rev B wiring, paint step",
			});

			detail = await c.organization.build.get({ id: build.id });
			expect(detail.availableUpgrades.map((v) => v.versionNumber)).toEqual([2]);

			const result = await c.organization.build.upgradeToVersion({
				buildId: build.id,
				templateVersionId: v2.id,
			});
			expect(result).toMatchObject({
				fromVersionNumber: 1,
				toVersionNumber: 2,
				added: 1, // Paint
				removed: 1, // Function test (untouched)
				kept: 0,
				updated: 3, // frame, cabinet, wiring
			});

			detail = await c.organization.build.get({ id: build.id });
			expect(detail.templateVersion?.versionNumber).toBe(2);
			expect(detail.availableUpgrades).toHaveLength(0);
			const after = Object.fromEntries(detail.tasks.map((t) => [t.title, t]));

			// Renamed in place, still the same build task.
			expect(after["Wire control cabinet (rev B)"]!.id).toBe(
				byTitle["Wire control cabinet"]!.id,
			);
			expect(after["Wire control cabinet (rev B)"]!.plannedDurationDays).toBe(
				2,
			);
			// Progress and assignments survived.
			expect(after["Mount frame"]!.status).toBe("done");
			expect(after["Assemble cabinet"]!.status).toBe("in_progress");
			expect(after["Assemble cabinet"]!.assignments).toHaveLength(1);
			expect(after["Assemble cabinet"]!.commentCount).toBe(1);
			// Finished task keeps its old checklist (no new item forced on it).
			expect(after["Mount frame"]!.checklistTotalCount).toBe(2);
			// New task present and depends on wiring; dropped task gone.
			expect(after["Paint"]).toBeDefined();
			expect(
				after["Paint"]!.dependencies.map((d) => d.dependsOnBuildTaskId),
			).toEqual([byTitle["Wire control cabinet"]!.id]);
			expect(after["Function test"]).toBeUndefined();

			// Second upgrade to the same version is refused.
			await expect(
				c.organization.build.upgradeToVersion({
					buildId: build.id,
					templateVersionId: v2.id,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			// Workers cannot upgrade.
			await expect(
				callerAs(
					worker,
					ORG_ID,
					MemberRole.member,
				).organization.build.upgradeToVersion({
					buildId: build.id,
					templateVersionId: tasks.frame.versionId,
				}),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});

		it("keeps a dropped task as ad-hoc when it has been worked on", async () => {
			const c = callerAs(planner);
			const { template } = await createPublishedTemplate(c);
			const product = await c.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});
			const build = await c.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});
			let detail = await c.organization.build.get({ id: build.id });
			const test = detail.tasks.find((t) => t.title === "Function test")!;
			await c.organization.build.assign({
				buildTaskIds: [test.id],
				userId: WORKER_ID,
			});

			const draft = await c.organization.template.ensureDraft({
				templateId: template.id,
			});
			const draftDetail = await c.organization.template.getVersion({
				versionId: draft.id,
			});
			await c.organization.template.deleteTask({
				id: draftDetail.tasks.find((t) => t.title === "Function test")!.id,
			});
			const v2 = await c.organization.template.publish({ versionId: draft.id });

			const result = await c.organization.build.upgradeToVersion({
				buildId: build.id,
				templateVersionId: v2.id,
			});
			expect(result.removed).toBe(0);
			expect(result.kept).toBe(1);

			detail = await c.organization.build.get({ id: build.id });
			const keptTask = detail.tasks.find((t) => t.title === "Function test")!;
			expect(keptTask.sourceTemplateTaskId).toBeNull();
			expect(keptTask.assignments).toHaveLength(1);
		});

		it("notifies workers on assignment and planners on comments and blockers", async () => {
			const c = callerAs(planner);
			const { template } = await createPublishedTemplate(c);
			const product = await c.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});
			const builds = [];
			for (let i = 1; i <= 3; i++) {
				builds.push(
					await c.organization.build.create({
						productId: product.id,
						serialNumber: `XY-000${i}`,
						plannedStartDate: `2026-10-0${i}`,
					}),
				);
			}
			const grid = await c.organization.build.assignmentGrid({
				templateId: template.id,
			});
			const frameRow = grid.rows.find((r) => r.title === "Mount frame")!;
			const frameIds = Object.values(frameRow.cells)
				.filter((cell): cell is NonNullable<typeof cell> => cell !== null)
				.map((cell) => cell.id);

			await c.organization.build.assign({
				buildTaskIds: frameIds,
				userId: WORKER_ID,
			});

			// One aggregated notification for the worker, none for the planner.
			const w = callerAs(worker, ORG_ID, MemberRole.member);
			let workerInbox = await w.notification.list({ limit: 20, status: "all" });
			expect(workerInbox).toHaveLength(1);
			expect(workerInbox[0]!.title).toBe("3 tasks assigned to you");
			expect(workerInbox[0]!.message).toBe("Mount frame on 3 builds");
			expect(workerInbox[0]!.actionUrl).toBe("/dashboard/work");

			// Worker blocks one task and comments -> planner gets both.
			await w.organization.work.updateStatus({
				id: frameIds[0]!,
				status: "in_progress",
			});
			// Blocking without a reason is refused; the reason becomes a comment.
			await expect(
				w.organization.work.updateStatus({
					id: frameIds[0]!,
					status: "blocked",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await w.organization.work.updateStatus({
				id: frameIds[0]!,
				status: "blocked",
				reason: "Missing bolts, ordered new ones",
			});
			const blockedTask = await w.organization.work.getTask({
				id: frameIds[0]!,
			});
			expect(blockedTask.status).toBe("blocked");
			expect(blockedTask.comments.map((c) => c.body)).toEqual([
				"Missing bolts, ordered new ones",
			]);
			await w.organization.work.addComment({
				buildTaskId: frameIds[0]!,
				body: "Supplier says Thursday.",
			});

			const plannerInbox = await callerAs(planner).notification.list({
				limit: 20,
				status: "all",
			});
			expect(plannerInbox.map((n) => n.title).sort()).toEqual(
				["Task blocked: Mount frame", "Worker commented on Mount frame"].sort(),
			);
			const blocked = plannerInbox.find((n) => n.type === "warning")!;
			expect(blocked.message).toContain("Missing bolts");
			expect(blocked.actionUrl).toBe(
				`/dashboard/organization/projects/${builds[0]!.id}`,
			);

			// Author does not get notified about their own comment.
			workerInbox = await callerAs(
				worker,
				ORG_ID,
				MemberRole.member,
			).notification.list({
				limit: 20,
				status: "all",
			});
			expect(workerInbox).toHaveLength(1);
		});

		it("tells the next worker when their task becomes ready", async () => {
			const c = callerAs(planner);
			const { template } = await createPublishedTemplate(c);
			const product = await c.organization.product.create({
				name: "Machine XY",
				templateId: template.id,
			});
			const build = await c.organization.build.create({
				productId: product.id,
				serialNumber: "XY-0001",
				plannedStartDate: "2026-10-01",
			});
			const detail = await c.organization.build.get({ id: build.id });
			const byTitle = Object.fromEntries(detail.tasks.map((t) => [t.title, t]));

			// Planner does frame + cabinet themselves; worker owns wiring.
			await c.organization.build.assign({
				buildTaskIds: [
					byTitle["Mount frame"]!.id,
					byTitle["Assemble cabinet"]!.id,
				],
				userId: PLANNER_ID,
			});
			await c.organization.build.assign({
				buildTaskIds: [byTitle["Wire control cabinet"]!.id],
				userId: WORKER_ID,
			});

			await c.organization.work.updateStatus({
				id: byTitle["Mount frame"]!.id,
				status: "done",
			});
			// Cabinet still open -> wiring not ready yet.
			let inbox = await callerAs(
				worker,
				ORG_ID,
				MemberRole.member,
			).notification.list({ limit: 20, status: "all" });
			expect(inbox.some((n) => n.title.startsWith("Ready to start"))).toBe(
				false,
			);

			await callerAs(planner).organization.work.updateStatus({
				id: byTitle["Assemble cabinet"]!.id,
				status: "done",
			});
			inbox = await callerAs(
				worker,
				ORG_ID,
				MemberRole.member,
			).notification.list({
				limit: 20,
				status: "all",
			});
			const ready = inbox.find((n) => n.title.startsWith("Ready to start"))!;
			expect(ready.title).toBe("Ready to start: Wire control cabinet");
			expect(ready.actionUrl).toBe(
				`/dashboard/work/tasks/${byTitle["Wire control cabinet"]!.id}`,
			);
		});

		it("speaks the worker's language in notifications", async () => {
			const w = callerAs(worker, ORG_ID, MemberRole.member);
			await w.user.setLocale({ locale: "de" });

			const c = callerAs(planner);
			const { template } = await createPublishedTemplate(c);
			const product = await c.organization.product.create({
				name: "Machine DE",
				templateId: template.id,
			});
			const build = await c.organization.build.create({
				productId: product.id,
				serialNumber: "DE-0001",
				plannedStartDate: "2026-10-01",
			});
			const detail = await c.organization.build.get({ id: build.id });
			const frame = detail.tasks.find((t) => t.title === "Mount frame")!;
			await c.organization.build.assign({
				buildTaskIds: [frame.id],
				userId: WORKER_ID,
			});
			await c.organization.work.addComment({
				buildTaskId: frame.id,
				body: "Bitte zuerst prüfen.",
			});

			const inbox = await callerAs(
				worker,
				ORG_ID,
				MemberRole.member,
			).notification.list({ limit: 20, status: "all" });
			expect(inbox.map((n) => n.title).sort()).toEqual(
				[
					"Neue Aufgabe zugewiesen",
					"Planner hat Mount frame kommentiert",
				].sort(),
			);

			// Planner side stays English.
			await w.organization.work.updateStatus({
				id: frame.id,
				status: "in_progress",
			});
			await w.organization.work.updateStatus({
				id: frame.id,
				status: "blocked",
				reason: "Teile fehlen",
			});
			const plannerInbox = await callerAs(planner).notification.list({
				limit: 20,
				status: "all",
			});
			expect(
				plannerInbox.some((n) => n.title === "Task blocked: Mount frame"),
			).toBe(true);
		});
	});

	describe("project first: blank projects and templates from projects", () => {
		it("creates a blank project, then saves it as a template and links it", async () => {
			const c = callerAs(planner);

			const project = await c.organization.build.create({
				serialNumber: "PROTO-1",
				plannedStartDate: "2026-10-01",
			});
			expect(project.productId).toBeNull();
			expect(project.templateVersionId).toBeNull();

			// Nothing to save yet.
			await expect(
				c.organization.build.saveAsTemplate({
					buildId: project.id,
					name: "Truck",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			const frame = await c.organization.build.createTask({
				buildId: project.id,
				title: "Weld frame",
				phase: "Mechanics",
				plannedDurationDays: 2,
			});
			const paint = await c.organization.build.createTask({
				buildId: project.id,
				title: "Paint frame",
				phase: "Finish",
				plannedDurationDays: 1,
				requiresPhoto: true,
				dependsOnIds: [frame.id],
			});

			const { template, version } = await c.organization.build.saveAsTemplate({
				buildId: project.id,
				name: "Truck",
				description: "Standard truck build",
			});
			expect(version.versionNumber).toBe(1);
			expect(version.status).toBe("published");

			// Template content mirrors the project, including order.
			const v1 = await c.organization.template.getVersion({
				versionId: version.id,
			});
			expect(v1.tasks.map((t) => t.title)).toEqual([
				"Weld frame",
				"Paint frame",
			]);
			const tplPaint = v1.tasks.find((t) => t.title === "Paint frame")!;
			expect(tplPaint.requiresPhoto).toBe(true);
			expect(tplPaint.dependencies).toHaveLength(1);

			// Project is now linked and its tasks point at the template tasks.
			const detail = await c.organization.build.get({ id: project.id });
			expect(detail.templateVersionId).toBe(version.id);
			expect(detail.templateVersion?.template.name).toBe("Truck");
			expect(detail.tasks.every((t) => t.sourceTemplateTaskId !== null)).toBe(
				true,
			);
			expect(detail.availableUpgrades).toHaveLength(0);
			expect(paint.id).toBeDefined();

			// The template can now seed the next unit.
			const next = await c.organization.build.create({
				templateId: template.id,
				serialNumber: "TRUCK-0002",
				plannedStartDate: "2026-11-01",
			});
			const nextDetail = await c.organization.build.get({ id: next.id });
			expect(nextDetail.tasks.map((t) => t.title)).toEqual([
				"Weld frame",
				"Paint frame",
			]);

			// Saving again is refused; the project belongs to a template now.
			await expect(
				c.organization.build.saveAsTemplate({
					buildId: project.id,
					name: "Truck 2",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			// Grid groups projects by template.
			const grid = await c.organization.build.assignmentGrid({
				templateId: template.id,
			});
			expect(grid.builds).toHaveLength(2);
			expect(grid.rows).toHaveLength(2);
		});

		it("previews and pushes project changes into the template as a new version", async () => {
			const c = callerAs(planner);
			const { template, version: v1 } = await createPublishedTemplate(c);

			const project = await c.organization.build.create({
				templateId: template.id,
				serialNumber: "XY-0007",
				plannedStartDate: "2026-10-01",
			});
			let detail = await c.organization.build.get({ id: project.id });

			// No differences yet.
			let preview = await c.organization.build.templateDiff({
				buildId: project.id,
			});
			expect(preview.diff.added).toHaveLength(0);
			expect(preview.diff.updated).toHaveLength(0);
			expect(preview.diff.removed).toHaveLength(0);
			expect(preview.diff.unchanged).toBe(4);
			await expect(
				c.organization.build.updateTemplate({ buildId: project.id }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			// Refine on the real unit: reword, add a step, drop one.
			const wiring = detail.tasks.find(
				(t) => t.title === "Wire control cabinet",
			)!;
			const cabinet = detail.tasks.find((t) => t.title === "Assemble cabinet")!;
			const test = detail.tasks.find((t) => t.title === "Function test")!;
			await c.organization.build.updateTask({
				id: wiring.id,
				instructions: "Use 2.5mm² for the mains feed.",
			});
			await c.organization.build.createTask({
				buildId: project.id,
				title: "Label terminals",
				phase: "Electrics",
				dependsOnIds: [wiring.id],
			});
			await c.organization.build.deleteTask({ id: cabinet.id });

			preview = await c.organization.build.templateDiff({
				buildId: project.id,
			});
			expect(preview.baselineVersionNumber).toBe(1);
			expect(preview.nextVersionNumber).toBe(2);
			expect(preview.diff.added.map((t) => t.title)).toEqual([
				"Label terminals",
			]);
			expect(preview.diff.removed.map((t) => t.title)).toEqual([
				"Assemble cabinet",
			]);
			const updatedTitles = preview.diff.updated.map((t) => t.title).sort();
			// Wiring: new instructions and one dependency fewer.
			expect(updatedTitles).toContain("Wire control cabinet");
			expect(
				preview.diff.updated.find((t) => t.title === "Wire control cabinet")!
					.fields,
			).toEqual(expect.arrayContaining(["instructions", "order"]));

			// A draft in the way blocks the push.
			const draft = await c.organization.template.ensureDraft({
				templateId: template.id,
			});
			await expect(
				c.organization.build.updateTemplate({ buildId: project.id }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await c.organization.template.discardDraft({ versionId: draft.id });

			const pushed = await c.organization.build.updateTemplate({
				buildId: project.id,
				changeNote: "Learned on XY-0007",
			});
			expect(pushed.version.versionNumber).toBe(2);
			expect(pushed.version.status).toBe("published");
			expect(pushed.version.changeNote).toBe("Learned on XY-0007");

			const v2 = await c.organization.template.getVersion({
				versionId: pushed.version.id,
			});
			expect(v2.tasks.map((t) => t.title).sort()).toEqual(
				[
					"Function test",
					"Label terminals",
					"Mount frame",
					"Wire control cabinet",
				].sort(),
			);
			// Lineage survives the round trip so older projects can upgrade.
			const v1Detail = await c.organization.template.getVersion({
				versionId: v1.id,
			});
			const v1Wiring = v1Detail.tasks.find(
				(t) => t.title === "Wire control cabinet",
			)!;
			const v2Wiring = v2.tasks.find(
				(t) => t.title === "Wire control cabinet",
			)!;
			expect(v2Wiring.lineageId).toBe(v1Wiring.lineageId);
			expect(v2Wiring.instructions).toBe("Use 2.5mm² for the mains feed.");
			expect(test.id).toBeDefined();

			// The project is re-pointed at v2 with no pending upgrade.
			detail = await c.organization.build.get({ id: project.id });
			expect(detail.templateVersionId).toBe(pushed.version.id);
			expect(detail.availableUpgrades).toHaveLength(0);
			expect(detail.tasks.every((t) => t.sourceTemplateTaskId !== null)).toBe(
				true,
			);

			// An older project on v1 now sees the upgrade.
			const older = await c.organization.build.create({
				templateVersionId: v1.id,
				serialNumber: "XY-0008",
				plannedStartDate: "2026-10-01",
			});
			const olderDetail = await c.organization.build.get({ id: older.id });
			expect(olderDetail.availableUpgrades.map((u) => u.versionNumber)).toEqual(
				[2],
			);
		});

		it("carries planner documents into the template and keeps photos out", async () => {
			const c = callerAs(planner);
			const project = await c.organization.build.create({
				serialNumber: "DOC-1",
				plannedStartDate: "2026-10-01",
			});
			const task = await c.organization.build.createTask({
				buildId: project.id,
				title: "Drill holes",
			});

			const { storageKey } = await c.organization.build.taskDocumentUploadUrl({
				buildTaskId: task.id,
				fileName: "drawing.pdf",
				contentType: "application/pdf",
				sizeBytes: 1024,
			});
			await c.organization.build.addTaskDocument({
				buildTaskId: task.id,
				storageKey,
				fileName: "drawing.pdf",
				contentType: "application/pdf",
				sizeBytes: 1024,
			});
			// A worker photo on the same task.
			const photo = await c.organization.work.attachmentUploadUrl({
				buildTaskId: task.id,
				fileName: "photo.jpg",
				contentType: "image/jpeg",
				sizeBytes: 2048,
			});
			await c.organization.work.addAttachment({
				buildTaskId: task.id,
				storageKey: photo.storageKey,
				fileName: "photo.jpg",
				contentType: "image/jpeg",
				sizeBytes: 2048,
			});

			const taskDetail = await c.organization.work.getTask({ id: task.id });
			expect(taskDetail.documents.map((d) => d.fileName)).toEqual([
				"drawing.pdf",
			]);
			expect(taskDetail.uploads.map((d) => d.fileName)).toEqual(["photo.jpg"]);

			const { version } = await c.organization.build.saveAsTemplate({
				buildId: project.id,
				name: "Drilling",
			});
			const v1 = await c.organization.template.getVersion({
				versionId: version.id,
			});
			expect(v1.tasks[0]!.documents.map((d) => d.fileName)).toEqual([
				"drawing.pdf",
			]);

			// The project's document is now linked to the template document.
			const after = await c.organization.work.getTask({ id: task.id });
			expect(after.documents[0]!.templateDocumentId).toBe(
				v1.tasks[0]!.documents[0]!.id,
			);
		});

		it("keeps serial numbers unique per organization", async () => {
			const c = callerAs(planner);
			await c.organization.build.create({
				serialNumber: "S-1",
				plannedStartDate: "2026-10-01",
			});
			await expect(
				c.organization.build.create({
					serialNumber: "S-1",
					plannedStartDate: "2026-10-02",
				}),
			).rejects.toMatchObject({ code: "CONFLICT" });
		});
	});
});
