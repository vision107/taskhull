import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	buildTable,
	db,
	memberTable,
	organizationTable,
	privateTaskTable,
	userTable,
} from "@/lib/db";
import { MemberRole } from "@/lib/db/schema/enums";
import { createTestTRPCContext } from "@/tests/support/trpc-utils";
import { createCallerFactory } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/app";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
	await db.delete(privateTaskTable);
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

	// Both users are in both organizations so the same person can be tested
	// across tenants.
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("private task router", () => {
	beforeEach(async () => {
		await seed();
	});

	it("keeps each member's list to themselves inside one organization", async () => {
		const workerCaller = callerAs(worker, ORG_ID, MemberRole.member);
		const note = await workerCaller.organization.privateTask.create({
			title: "Ask about bracket 4711",
			notes: "2 pcs missing",
		});
		expect(note).toMatchObject({
			organizationId: ORG_ID,
			userId: WORKER_ID,
			title: "Ask about bracket 4711",
			notes: "2 pcs missing",
			completedAt: null,
		});

		const mine = await workerCaller.organization.privateTask.list({});
		expect(mine.map((task) => task.id)).toEqual([note.id]);

		// The owner of the organization cannot see, change or delete it.
		const ownerCaller = callerAs(planner);
		expect(await ownerCaller.organization.privateTask.list({})).toEqual([]);
		await expect(
			ownerCaller.organization.privateTask.update({
				id: note.id,
				title: "Hijacked",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			ownerCaller.organization.privateTask.delete({ id: note.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("scopes the list to the active organization", async () => {
		const here = callerAs(worker, ORG_ID, MemberRole.member);
		const note = await here.organization.privateTask.create({
			title: "Only in Notes Org",
		});

		const there = callerAs(worker, OTHER_ORG_ID, MemberRole.member);
		expect(await there.organization.privateTask.list({})).toEqual([]);
		await expect(
			there.organization.privateTask.update({ id: note.id, done: true }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("ticks notes off, hides them by default and orders open ones by due date", async () => {
		const c = callerAs(worker, ORG_ID, MemberRole.member);
		const later = await c.organization.privateTask.create({
			title: "Later",
			dueDate: "2030-02-01",
		});
		const undated = await c.organization.privateTask.create({
			title: "Whenever",
		});
		const soon = await c.organization.privateTask.create({
			title: "Soon",
			dueDate: "2030-01-01",
		});

		expect(
			(await c.organization.privateTask.list({})).map((task) => task.title),
		).toEqual(["Soon", "Later", "Whenever"]);

		const done = await c.organization.privateTask.update({
			id: soon.id,
			done: true,
		});
		expect(done.completedAt).toBeInstanceOf(Date);

		// Marking done again keeps the original completion time.
		const again = await c.organization.privateTask.update({
			id: soon.id,
			done: true,
		});
		expect(again.completedAt?.getTime()).toBe(done.completedAt?.getTime());

		expect(
			(await c.organization.privateTask.list({})).map((task) => task.id),
		).toEqual([later.id, undated.id]);

		const all = await c.organization.privateTask.list({ includeDone: true });
		expect(all.map((task) => task.title)).toEqual([
			"Later",
			"Whenever",
			"Soon",
		]);

		const reopened = await c.organization.privateTask.update({
			id: soon.id,
			done: false,
		});
		expect(reopened.completedAt).toBeNull();
	});

	it("edits fields independently and clears them with null", async () => {
		const c = callerAs(worker, ORG_ID, MemberRole.member);
		const note = await c.organization.privateTask.create({
			title: "Check torque",
			notes: "Spec sheet p. 4",
			dueDate: "2030-03-03",
		});

		const renamed = await c.organization.privateTask.update({
			id: note.id,
			title: "Check torque on M12",
		});
		expect(renamed).toMatchObject({
			title: "Check torque on M12",
			notes: "Spec sheet p. 4",
			dueDate: "2030-03-03",
		});

		const cleared = await c.organization.privateTask.update({
			id: note.id,
			notes: null,
			dueDate: null,
		});
		expect(cleared).toMatchObject({
			title: "Check torque on M12",
			notes: null,
			dueDate: null,
		});

		await c.organization.privateTask.delete({ id: note.id });
		expect(await c.organization.privateTask.list({})).toEqual([]);
	});

	it("links a note to a project task of the same organization only", async () => {
		const plannerCaller = callerAs(planner);
		const project = await plannerCaller.organization.build.create({
			serialNumber: "NOTE-1",
			plannedStartDate: "2030-01-06",
		});
		const task = await plannerCaller.organization.build.createTask({
			buildId: project.id,
			title: "Weld frame",
		});

		const foreignProject = await callerAs(
			planner,
			OTHER_ORG_ID,
		).organization.build.create({
			serialNumber: "NOTE-2",
			plannedStartDate: "2030-01-06",
		});
		const foreignTask = await callerAs(
			planner,
			OTHER_ORG_ID,
		).organization.build.createTask({
			buildId: foreignProject.id,
			title: "Foreign task",
		});

		const c = callerAs(worker, ORG_ID, MemberRole.member);
		await expect(
			c.organization.privateTask.create({
				title: "Nope",
				buildTaskId: foreignTask.id,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const note = await c.organization.privateTask.create({
			title: "Ask about the frame drawing",
			buildTaskId: task.id,
		});
		const [listed] = await c.organization.privateTask.list({});
		expect(listed?.buildTask).toMatchObject({
			id: task.id,
			title: "Weld frame",
			build: { serialNumber: "NOTE-1" },
		});

		// The link can be cleared and set again; other fields stay untouched.
		const unlinked = await c.organization.privateTask.update({
			id: note.id,
			buildTaskId: null,
		});
		expect(unlinked.buildTaskId).toBeNull();
		expect(unlinked.title).toBe("Ask about the frame drawing");
		const relinked = await c.organization.privateTask.update({
			id: note.id,
			buildTaskId: task.id,
		});
		expect(relinked.buildTaskId).toBe(task.id);
		await expect(
			c.organization.privateTask.update({
				id: note.id,
				buildTaskId: foreignTask.id,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		// Deleting the project leaves the note in place, just unlinked.
		await callerAs(planner).organization.build.delete({ id: project.id });
		const [afterDelete] = await callerAs(
			worker,
			ORG_ID,
			MemberRole.member,
		).organization.privateTask.list({});
		expect(afterDelete?.id).toBe(note.id);
		expect(afterDelete?.buildTask).toBeNull();
	});
});
