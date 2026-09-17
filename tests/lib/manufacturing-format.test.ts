import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	dueDateFromEnd,
	dueIso,
	formatTaskDueLabel,
	matchesDueChip,
	matchesDueRange,
} from "@/lib/manufacturing/format";

const labels = { today: "Today", unscheduled: "Unscheduled" };

afterEach(() => {
	vi.useRealTimers();
});

describe("dueDateFromEnd", () => {
	it("subtracts a day for exclusive ranges", () => {
		expect(
			format(dueDateFromEnd("2026-03-20", "2026-03-18")!, "yyyy-MM-dd"),
		).toBe("2026-03-19");
	});

	it("keeps a zero-duration milestone on its calendar day", () => {
		expect(
			format(dueDateFromEnd("2026-03-15", "2026-03-15")!, "yyyy-MM-dd"),
		).toBe("2026-03-15");
	});
});

describe("formatTaskDueLabel", () => {
	it("uses the last working day of an exclusive end date", () => {
		expect(
			formatTaskDueLabel(
				{
					endDate: "2026-03-20",
					startDate: "2026-03-18",
					status: "todo",
				},
				labels,
			).text,
		).toBe("19. Mar");
	});

	it("keeps a zero-duration milestone on its own day", () => {
		expect(
			formatTaskDueLabel(
				{
					endDate: "2026-03-15",
					startDate: "2026-03-15",
					status: "todo",
				},
				labels,
			).text,
		).toBe("15. Mar");
	});

	it("falls back to startDate when endDate is missing", () => {
		expect(
			formatTaskDueLabel({ startDate: "2026-03-15", status: "todo" }, labels)
				.text,
		).toBe("15. Mar");
	});

	it("returns today when the due date is today", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 19));
		expect(
			formatTaskDueLabel(
				{
					endDate: "2026-03-20",
					startDate: "2026-03-18",
					status: "todo",
				},
				labels,
			),
		).toEqual({ text: "Today", overdue: false });
	});

	it("marks a past due date overdue unless the task is done", () => {
		expect(
			formatTaskDueLabel({ endDate: "2020-01-02", status: "todo" }, labels)
				.overdue,
		).toBe(true);
		expect(
			formatTaskDueLabel({ endDate: "2020-01-02", status: "done" }, labels)
				.overdue,
		).toBe(false);
	});

	it("returns unscheduled when no dates exist", () => {
		expect(formatTaskDueLabel({ status: "todo" }, labels)).toEqual({
			text: "Unscheduled",
			overdue: false,
		});
	});
});

describe("due chips", () => {
	const today = new Date(2026, 2, 19);

	it("classifies overdue, today, this week and later", () => {
		expect(
			matchesDueChip(
				{ endDate: "2026-03-18", startDate: "2026-03-17", status: "todo" },
				"overdue",
				today,
			),
		).toBe(true);
		expect(
			matchesDueChip(
				{ endDate: "2026-03-20", startDate: "2026-03-18", status: "todo" },
				"today",
				today,
			),
		).toBe(true);
		expect(
			matchesDueChip(
				{ endDate: "2026-03-23", startDate: "2026-03-22", status: "todo" },
				"week",
				today,
			),
		).toBe(true);
		expect(
			matchesDueChip(
				{ endDate: "2026-04-02", startDate: "2026-04-01", status: "todo" },
				"later",
				today,
			),
		).toBe(true);
	});

	it("does not treat a finished past task as overdue", () => {
		expect(
			matchesDueChip({ endDate: "2026-03-10", status: "done" }, "overdue", today),
		).toBe(false);
	});

	it("filters an inclusive due range by the displayed due date", () => {
		const task = { endDate: "2026-03-20", startDate: "2026-03-18" };
		expect(dueIso(task)).toBe("2026-03-19");
		expect(matchesDueRange(task, { dueAfter: "2026-03-19", dueBefore: "2026-03-19" })).toBe(
			true,
		);
		expect(matchesDueRange(task, { dueBefore: "2026-03-18" })).toBe(false);
	});
});
