import { describe, expect, it } from "vitest";

import { hasDependencyCycle } from "@/lib/manufacturing/template-versions";

describe("hasDependencyCycle", () => {
	it("returns false for an empty graph", () => {
		expect(hasDependencyCycle([], [])).toBe(false);
	});

	it("returns false for a linear chain", () => {
		expect(
			hasDependencyCycle(
				["a", "b", "c"],
				[
					["b", "a"],
					["c", "b"],
				],
			),
		).toBe(false);
	});

	it("returns false for a diamond", () => {
		expect(
			hasDependencyCycle(
				["a", "b", "c", "d"],
				[
					["b", "a"],
					["c", "a"],
					["d", "b"],
					["d", "c"],
				],
			),
		).toBe(false);
	});

	it("detects a self dependency", () => {
		expect(hasDependencyCycle(["a"], [["a", "a"]])).toBe(true);
	});

	it("detects a two-node cycle", () => {
		expect(
			hasDependencyCycle(
				["a", "b"],
				[
					["a", "b"],
					["b", "a"],
				],
			),
		).toBe(true);
	});

	it("detects a longer cycle mixed with acyclic parts", () => {
		expect(
			hasDependencyCycle(
				["a", "b", "c", "d", "e"],
				[
					["b", "a"],
					["c", "b"],
					["d", "c"],
					["b", "d"],
					["e", "a"],
				],
			),
		).toBe(true);
	});
});
