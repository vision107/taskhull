import { describe, expect, it } from "vitest";

import {
	filterWorkTasks,
	glanceFromTasks,
	nextCycledStatus,
	sortWorkTasks,
	workSection,
} from "@/lib/manufacturing/work-list";

const build = {
	id: "b1",
	serialNumber: "XY-1",
	name: "Unit",
	templateVersion: { template: { name: "Machine" } },
};

function task(overrides: Record<string, unknown> = {}) {
	return {
		title: "Wire cabinet",
		phase: "Electrics",
		status: "todo",
		startDate: "2026-03-19",
		endDate: "2026-03-20",
		plannedHours: 4,
		openBlockers: [],
		parent: null,
		build,
		...overrides,
	};
}

describe("work list helpers", () => {
	it("cycles status the way the list keyboard shortcut does", () => {
		expect(nextCycledStatus("todo")).toBe("in_progress");
		expect(nextCycledStatus("in_progress")).toBe("done");
		expect(nextCycledStatus("done")).toBe("in_progress");
		expect(nextCycledStatus("blocked")).toBe("in_progress");
		expect(nextCycledStatus("review")).toBe("done");
	});

	it("sorts by project, phase and effort", () => {
		const a = task({
			title: "A",
			phase: "QA",
			plannedHours: 1,
			build: {
				...build,
				serialNumber: "XY-2",
				templateVersion: { template: { name: "Zed" } },
			},
		});
		const b = task({
			title: "B",
			phase: "Electrics",
			plannedHours: 8,
			build: {
				...build,
				serialNumber: "XY-1",
				templateVersion: { template: { name: "Alpha" } },
			},
		});
		expect(sortWorkTasks([a, b], "project").map((item) => item.title)).toEqual([
			"B",
			"A",
		]);
		expect(sortWorkTasks([a, b], "phase").map((item) => item.title)).toEqual([
			"B",
			"A",
		]);
		expect(sortWorkTasks([a, b], "effort").map((item) => item.title)).toEqual([
			"B",
			"A",
		]);
	});

	it("filters by section, project, phase, due and title", () => {
		const today = new Date(2026, 2, 19);
		const ready = task({ title: "Ready one" });
		const waiting = task({
			title: "Waiting one",
			openBlockers: [{ id: "x" }],
		});
		const other = task({
			title: "Other phase",
			phase: "QA",
			build: { ...build, id: "b2" },
		});
		const filtered = filterWorkTasks(
			[ready, waiting, other],
			{ section: "ready", phase: "Electrics", query: "ready" },
			today,
		);
		expect(filtered.map((item) => item.title)).toEqual(["Ready one"]);
		expect(workSection(waiting)).toBe("waiting");
	});

	it("counts ready, waiting and hours due today", () => {
		const today = new Date(2026, 2, 19);
		const glance = glanceFromTasks(
			[
				task({ plannedHours: 4 }),
				task({
					title: "Blocked",
					openBlockers: [{}],
					plannedHours: 2,
				}),
				task({
					title: "Later",
					endDate: "2026-04-02",
					startDate: "2026-04-01",
					plannedHours: 10,
				}),
			],
			today,
		);
		expect(glance).toEqual({ ready: 2, waiting: 1, hoursToday: 6 });
	});
});
