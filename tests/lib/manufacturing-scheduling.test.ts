import { describe, expect, it } from "vitest";

import { latestEndDate, scheduleTasks } from "@/lib/manufacturing/scheduling";

describe("scheduleTasks", () => {
	it("starts independent tasks in parallel on the start date", () => {
		const result = scheduleTasks(
			[
				{ id: "a", durationDays: 2, dependsOn: [] },
				{ id: "b", durationDays: 3, dependsOn: [] },
			],
			"2026-10-01",
		);

		expect(result).toEqual([
			{ id: "a", startDate: "2026-10-01", endDate: "2026-10-03" },
			{ id: "b", startDate: "2026-10-01", endDate: "2026-10-04" },
		]);
	});

	it("starts a task after the latest of its dependencies", () => {
		const result = scheduleTasks(
			[
				{ id: "frame", durationDays: 2, dependsOn: [] },
				{ id: "cabinet", durationDays: 4, dependsOn: [] },
				{ id: "wiring", durationDays: 1, dependsOn: ["frame", "cabinet"] },
				{ id: "test", durationDays: 1, dependsOn: ["wiring"] },
			],
			"2026-10-01",
		);
		const byId = Object.fromEntries(result.map((r) => [r.id, r]));

		expect(byId.wiring).toEqual({
			id: "wiring",
			startDate: "2026-10-05",
			endDate: "2026-10-06",
		});
		expect(byId.test).toEqual({
			id: "test",
			startDate: "2026-10-06",
			endDate: "2026-10-07",
		});
		expect(latestEndDate(result)).toBe("2026-10-07");
	});

	it("ignores dependencies on unknown tasks", () => {
		const result = scheduleTasks(
			[{ id: "a", durationDays: 1, dependsOn: ["ghost"] }],
			"2026-10-01",
		);
		expect(result[0]).toEqual({
			id: "a",
			startDate: "2026-10-01",
			endDate: "2026-10-02",
		});
	});

	it("falls back to the start date for tasks in a cycle", () => {
		const result = scheduleTasks(
			[
				{ id: "a", durationDays: 1, dependsOn: ["b"] },
				{ id: "b", durationDays: 1, dependsOn: ["a"] },
				{ id: "c", durationDays: 2, dependsOn: [] },
			],
			"2026-10-01",
		);
		expect(result).toHaveLength(3);
		for (const entry of result) {
			expect(entry.startDate).toBe("2026-10-01");
		}
	});

	it("treats zero-duration tasks as milestones", () => {
		const result = scheduleTasks(
			[
				{ id: "a", durationDays: 0, dependsOn: [] },
				{ id: "b", durationDays: 1, dependsOn: ["a"] },
			],
			"2026-10-01",
		);
		const byId = Object.fromEntries(result.map((r) => [r.id, r]));
		expect(byId.a?.endDate).toBe("2026-10-01");
		expect(byId.b?.startDate).toBe("2026-10-01");
	});

	it("returns null latest end date for an empty schedule", () => {
		expect(latestEndDate([])).toBeNull();
	});
});
