import { describe, expect, it } from "vitest";

import {
	assignBuildTasksSchema,
	createBuildSchema,
	createTemplateTaskSchema,
	publishTemplateVersionSchema,
	updateBuildTaskStatusSchema,
} from "@/schemas/manufacturing-schemas";

const uuid = "11111111-1111-4111-8111-111111111111";
const uuid2 = "22222222-2222-4222-8222-222222222222";

describe("manufacturing schemas", () => {
	it("applies defaults when creating a template task", () => {
		const parsed = createTemplateTaskSchema.parse({
			versionId: uuid,
			title: "  Wire control cabinet  ",
		});
		expect(parsed.title).toBe("Wire control cabinet");
		expect(parsed.durationDays).toBe(1);
		expect(parsed.requiresPhoto).toBe(false);
		expect(parsed.checklistItems).toEqual([]);
	});

	it("rejects an empty task title", () => {
		expect(() =>
			createTemplateTaskSchema.parse({ versionId: uuid, title: "   " }),
		).toThrow();
	});

	it("requires an ISO date for build start", () => {
		expect(() =>
			createBuildSchema.parse({
				productId: uuid,
				serialNumber: "SN-001",
				plannedStartDate: "01.10.2026",
			}),
		).toThrow();

		const parsed = createBuildSchema.parse({
			productId: uuid,
			serialNumber: "SN-001",
			plannedStartDate: "2026-10-01",
		});
		expect(parsed.templateVersionId).toBeUndefined();
	});

	it("defaults bulk assignment to replacing owners", () => {
		const parsed = assignBuildTasksSchema.parse({
			buildTaskIds: [uuid, uuid2],
			userId: uuid,
		});
		expect(parsed.role).toBe("owner");
		expect(parsed.replace).toBe(true);
	});

	it("rejects bulk assignment without tasks", () => {
		expect(() =>
			assignBuildTasksSchema.parse({ buildTaskIds: [], userId: uuid }),
		).toThrow();
	});

	it("only accepts known task statuses", () => {
		expect(
			updateBuildTaskStatusSchema.parse({ id: uuid, status: "in_progress" })
				.status,
		).toBe("in_progress");
		expect(() =>
			updateBuildTaskStatusSchema.parse({ id: uuid, status: "finished" }),
		).toThrow();
	});

	it("allows publishing without a change note", () => {
		expect(publishTemplateVersionSchema.parse({ versionId: uuid })).toEqual({
			versionId: uuid,
		});
	});
});
