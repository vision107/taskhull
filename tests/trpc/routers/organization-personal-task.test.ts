import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildTable,
	db,
	memberTable,
	organizationTable,
	userTable,
} from "@/lib/db";
import { MemberRole } from "@/lib/db/schema/enums";
import { createTestTRPCContext } from "@/tests/support/trpc-utils";
import { createCallerFactory } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/app";

const ORG_ID = "c1111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "c2222222-2222-4222-8222-222222222222";

const PLANNER_ID = "d1111111-1111-4111-8111-111111111111";
const WORKER_ID = "d2222222-2222-4222-8222-222222222222";

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

const planner = makeUser(PLANNER_ID, "PlannerP", "planner-p@example.com");
const worker = makeUser(WORKER_ID, "WorkerP", "worker-p@example.com");

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

async function seed() {
	await db.delete(buildTable);

	await db
		.insert(userTable)
		.values(
			[planner, worker].map((u) => ({
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
			{ id: ORG_ID, name: "Notes Org", slug: "notes-org" },
			{ id: OTHER_ORG_ID, name: "Notes Other Org", slug: "notes-other-org" },
		])
		.onConflictDoNothing();

	await db
		.insert(memberTable)
		.values([
			{ organizationId: ORG_ID, userId: PLANNER_ID, role: MemberRole.owner },
			{ organizationId: ORG_ID, userId: WORKER_ID, role: MemberRole.member },
			{
				organizationId: OTHER_ORG_ID,
				userId: PLANNER_ID,
				role: MemberRole.owner,
			},
			{
				organizationId: OTHER_ORG_ID,
				userId: WORKER_ID,
				role: MemberRole.member,
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

describe("personal list tasks", () => {
	beforeEach(async () => {
		await seed();
	});

	it("keeps each member's list to themselves and off the project board", async () => {
		const workerCaller = callerAs(worker, ORG_ID, MemberRole.member);
		const task = await workerCaller.organization.work.createPersonalTask({
			title: "Ask about bracket 4711",
		});
		expect(task).toMatchObject({
			organizationId: ORG_ID,
			title: "Ask about bracket 4711",
		});

		const mine = await workerCaller.organization.work.personalTasks({});
		expect(mine.map((row) => row.id)).toEqual([task.id]);
		expect(await workerCaller.organization.work.myTasks({})).toEqual([]);

		const ownerCaller = callerAs(planner);
		expect(await ownerCaller.organization.work.personalTasks({})).toEqual([]);
		expect(await ownerCaller.organization.work.teamTasks({})).toEqual([]);
		expect(
			(await ownerCaller.organization.build.list({})).map((build) => build.id),
		).toEqual([]);
		await expect(
			ownerCaller.organization.work.getTask({ id: task.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			ownerCaller.organization.work.deletePersonalTask({ id: task.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("scopes the list to the active organization", async () => {
		const here = callerAs(worker, ORG_ID, MemberRole.member);
		const task = await here.organization.work.createPersonalTask({
			title: "Only in Notes Org",
		});

		const there = callerAs(worker, OTHER_ORG_ID, MemberRole.member);
		expect(await there.organization.work.personalTasks({})).toEqual([]);
		await expect(
			there.organization.work.getTask({ id: task.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("hides finished tasks by default and lets the owner edit every field", async () => {
		const c = callerAs(worker, ORG_ID, MemberRole.member);
		const later = await c.organization.work.createPersonalTask({
			title: "Later",
		});
		const soon = await c.organization.work.createPersonalTask({
			title: "Soon",
		});

		await c.organization.build.updateTask({
			id: later.id,
			endDate: "2030-02-01",
			startDate: "2030-02-01",
			instructions: "Check the drawing",
		});
		await c.organization.build.updateTask({
			id: soon.id,
			endDate: "2030-01-01",
			startDate: "2030-01-01",
		});

		const fetched = await c.organization.work.getTask({ id: later.id });
		expect(fetched).toMatchObject({
			id: later.id,
			title: "Later",
			instructions: "Check the drawing",
			canEdit: true,
		});

		await c.organization.work.updateStatus({
			id: soon.id,
			status: "done",
		});

		expect(
			(await c.organization.work.personalTasks({})).map((row) => row.id),
		).toEqual([later.id]);
		expect(
			(await c.organization.work.personalTasks({ includeDone: true })).map(
				(row) => row.id,
			),
		).toEqual(expect.arrayContaining([later.id, soon.id]));

		await c.organization.work.deletePersonalTask({ id: later.id });
		expect(
			(await c.organization.work.personalTasks({})).map((row) => row.id),
		).toEqual([]);
	});

	it("refuses to share a personal task with the team", async () => {
		const workerCaller = callerAs(worker, ORG_ID, MemberRole.member);
		const task = await workerCaller.organization.work.createPersonalTask({
			title: "Keep this to myself",
		});

		const plannerCaller = callerAs(planner);
		await expect(
			plannerCaller.organization.build.assign({
				buildTaskIds: [task.id],
				userId: PLANNER_ID,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		await expect(
			callerAs(worker, ORG_ID, MemberRole.member).organization.build.assign({
				buildTaskIds: [task.id],
				userId: PLANNER_ID,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("stores personal items as real build tasks on a hidden build", async () => {
		const c = callerAs(worker, ORG_ID, MemberRole.member);
		const task = await c.organization.work.createPersonalTask({
			title: "Real task",
		});

		const stored = await db.query.buildTaskTable.findFirst({
			where: (t, { eq }) => eq(t.id, task.id),
		});
		expect(stored?.title).toBe("Real task");

		const build = await db.query.buildTable.findFirst({
			where: (t, { eq }) => eq(t.id, stored!.buildId),
		});
		expect(build).toMatchObject({
			organizationId: ORG_ID,
			ownerUserId: WORKER_ID,
			name: "My list",
		});
	});
});
