import { describe, expect, it } from "vitest";

import { computeChangedFields } from "@/lib/db/revision";

describe("computeChangedFields", () => {
	it("returns an empty list for identical rows", () => {
		expect(computeChangedFields({ a: 1, b: "x" }, { a: 1, b: "x" })).toEqual(
			[],
		);
	});

	it("lists changed, added and removed keys", () => {
		const changed = computeChangedFields(
			{ a: 1, b: "x", c: true },
			{ a: 2, b: "x", d: null },
		);
		expect(changed.sort()).toEqual(["a", "c", "d"]);
	});

	it("ignores timestamp housekeeping columns", () => {
		expect(
			computeChangedFields(
				{ a: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
				{ a: 1, createdAt: "2026-01-02", updatedAt: "2026-02-01" },
			),
		).toEqual([]);
	});

	it("compares nested values structurally", () => {
		expect(
			computeChangedFields({ meta: { x: [1, 2] } }, { meta: { x: [1, 2] } }),
		).toEqual([]);
		expect(
			computeChangedFields({ meta: { x: [1, 2] } }, { meta: { x: [1, 3] } }),
		).toEqual(["meta"]);
	});
});
