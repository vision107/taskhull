import { mkdtempSync } from "node:fs";
import {
	mkdir,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, type TestContext } from "vitest";

import {
	findProjectRoot,
	listComponents,
	listImplementationSources,
	listKnownFiles,
	readComponent,
	readImplementationSource,
	readKnownFile,
	searchComponents,
	searchDocumentation,
	searchImplementationSources,
} from "../../mcp/repository";

function createTemporaryDirectory(
	prefix: string,
	onTestFinished: TestContext["onTestFinished"],
): string {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	onTestFinished(async () => {
		await rm(directory, { force: true, recursive: true });
	});
	return directory;
}

describe("MCP repository file boundary", () => {
	it("keeps the MCP runtime read-only and offline", async () => {
		const runtimeDirectory = join(__dirname, "../../mcp");
		const runtimeSource = (
			await Promise.all(
				(
					await readdir(runtimeDirectory)
				)
					.filter((path) => path.endsWith(".ts"))
					.map((path) => readFile(join(runtimeDirectory, path), "utf8")),
			)
		).join("\n");

		expect(runtimeSource).not.toMatch(
			/from\s+["']node:(?:child_process|dgram|dns|http|https|net|tls)["']/,
		);
		expect(runtimeSource).not.toMatch(/\bfetch\s*\(/);
		expect(runtimeSource).not.toContain("process.env");
		expect(runtimeSource).not.toMatch(
			/\b(?:appendFile|chmod|chown|copyFile|cp|link|mkdir|mkdtemp|rename|rm|rmdir|symlink|truncate|unlink|writeFile)\s*\(/,
		);
	});

	it("finds the project root from a nested client working directory", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		const nestedDirectory = join(projectRoot, "app", "dashboard", "settings");
		await mkdir(join(projectRoot, "lib", "db", "schema"), { recursive: true });
		await mkdir(nestedDirectory, { recursive: true });
		await writeFile(join(projectRoot, "package.json"), "{}");
		await writeFile(join(projectRoot, "lib", "db", "schema", "index.ts"), "");

		expect(findProjectRoot([nestedDirectory])).toBe(projectRoot);
	});

	it("rejects parent-directory, absolute and null-byte paths", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);

		await expect(
			readKnownFile(projectRoot, "../secret.txt", ["../secret.txt"]),
		).rejects.toThrow("Invalid repository-relative path");
		await expect(
			readKnownFile(projectRoot, "/etc/passwd", ["/etc/passwd"]),
		).rejects.toThrow("Invalid repository-relative path");
		await expect(
			readKnownFile(projectRoot, "docs/\0secret.md", ["docs/\0secret.md"]),
		).rejects.toThrow("Invalid repository-relative path");
	});

	it("rejects a file reached through a symlinked parent directory", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		const outsideRoot = createTemporaryDirectory(
			"achromatic-mcp-outside-",
			onTestFinished,
		);
		await writeFile(join(outsideRoot, "secret.md"), "outside repository");
		await symlink(outsideRoot, join(projectRoot, "docs"));

		await expect(
			readKnownFile(projectRoot, "docs/secret.md", ["docs/secret.md"]),
		).rejects.toThrow("outside the project root");
		await expect(
			listKnownFiles(projectRoot, "docs", new Set([".md"])),
		).resolves.toEqual([]);
	});

	it("rejects symbolic-link files and oversized text files", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		await mkdir(join(projectRoot, "docs"));
		await writeFile(join(projectRoot, "target.md"), "target");
		await symlink(
			join(projectRoot, "target.md"),
			join(projectRoot, "docs", "linked.md"),
		);
		await writeFile(
			join(projectRoot, "docs", "oversized.md"),
			"x".repeat(512_001),
		);

		await expect(
			readKnownFile(projectRoot, "docs/linked.md", ["docs/linked.md"]),
		).rejects.toThrow("Path is not a file");
		await expect(
			readKnownFile(projectRoot, "docs/oversized.md", ["docs/oversized.md"]),
		).rejects.toThrow("File is too large");
	});

	it("limits implementation discovery to the documented source roots", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		for (const directory of [
			"app",
			"config",
			"hooks",
			"lib",
			"schemas",
			"scripts",
			"trpc",
			"types",
		]) {
			await mkdir(join(projectRoot, directory));
			await writeFile(
				join(projectRoot, directory, `${directory}.ts`),
				`export const ${directory} = true;`,
			);
		}

		const sources = await listImplementationSources(projectRoot, "all");

		expect(sources.map((source) => source.path)).toEqual([
			"app/app.ts",
			"config/config.ts",
			"hooks/hooks.ts",
			"lib/lib.ts",
			"schemas/schemas.ts",
			"trpc/trpc.ts",
			"types/types.ts",
		]);
		expect(sources.some((source) => source.path.startsWith("scripts/"))).toBe(
			false,
		);
	});

	it("caps broad component, documentation and implementation searches", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		await mkdir(join(projectRoot, "app"), { recursive: true });
		await mkdir(join(projectRoot, "components", "ui"), { recursive: true });
		await mkdir(join(projectRoot, "content", "docs"), { recursive: true });
		const matchingLines = Array.from(
			{ length: 60 },
			(_, index) => `bounded-search match ${index + 1}`,
		).join("\n");
		await writeFile(join(projectRoot, "app", "matches.ts"), matchingLines);
		await writeFile(
			join(projectRoot, "components", "ui", "matches.tsx"),
			matchingLines,
		);
		await writeFile(
			join(projectRoot, "content", "docs", "matches.md"),
			matchingLines,
		);

		const [
			componentMatches,
			implementationMatches,
			documentationMatches,
			componentProbe,
			implementationProbe,
			documentationProbe,
		] = await Promise.all([
			searchComponents(projectRoot, "bounded-search", "all"),
			searchImplementationSources(projectRoot, "bounded-search", "all"),
			searchDocumentation(projectRoot, "bounded-search"),
			searchComponents(projectRoot, "bounded-search", "all", 51),
			searchImplementationSources(projectRoot, "bounded-search", "all", 51),
			searchDocumentation(projectRoot, "bounded-search", 51),
		]);

		expect(componentMatches).toHaveLength(50);
		expect(implementationMatches).toHaveLength(50);
		expect(documentationMatches).toHaveLength(50);
		expect(componentMatches.at(-1)?.line).toBe(50);
		expect(implementationMatches.at(-1)?.line).toBe(50);
		expect(documentationMatches.at(-1)?.line).toBe(50);
		expect(componentProbe).toHaveLength(51);
		expect(implementationProbe).toHaveLength(51);
		expect(documentationProbe).toHaveLength(51);
		expect(componentProbe.at(-1)?.line).toBe(51);
		expect(implementationProbe.at(-1)?.line).toBe(51);
		expect(documentationProbe.at(-1)?.line).toBe(51);
	});

	it("searches and reads implementation files beyond the discovery cap", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		await mkdir(join(projectRoot, "app"), { recursive: true });

		for (let index = 0; index < 260; index += 1) {
			await writeFile(
				join(projectRoot, "app", `source-${String(index).padStart(3, "0")}.ts`),
				index === 259
					? "export const beyondDiscoveryCap = true;"
					: `export const source${index} = true;`,
			);
		}

		const listedSources = await listImplementationSources(projectRoot, "all");
		const discoveryProbe = await listImplementationSources(
			projectRoot,
			"all",
			undefined,
			251,
		);
		const filteredSources = await listImplementationSources(
			projectRoot,
			"all",
			"source-259",
		);
		const matches = await searchImplementationSources(
			projectRoot,
			"beyondDiscoveryCap",
			"all",
		);
		const content = await readImplementationSource(
			projectRoot,
			"app/source-259.ts",
		);

		expect(listedSources).toHaveLength(250);
		expect(discoveryProbe).toHaveLength(251);
		expect(filteredSources).toEqual([
			{ path: "app/source-259.ts", area: "routes" },
		]);
		expect(matches).toEqual([
			{
				path: "app/source-259.ts",
				line: 1,
				excerpt: "export const beyondDiscoveryCap = true;",
			},
		]);
		expect(content).toContain("beyondDiscoveryCap");
	});

	it("reads a component beyond the discovery cap", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		await mkdir(join(projectRoot, "components", "ui"), { recursive: true });

		for (let index = 0; index < 260; index += 1) {
			await writeFile(
				join(
					projectRoot,
					"components",
					"ui",
					`component-${String(index).padStart(3, "0")}.tsx`,
				),
				index === 259
					? "export function BeyondDiscoveryCap() { return null; }"
					: `export function Component${index}() { return null; }`,
			);
		}

		const listedComponents = await listComponents(projectRoot, "all");
		const discoveryProbe = await listComponents(
			projectRoot,
			"all",
			undefined,
			251,
		);
		const filteredComponents = await listComponents(
			projectRoot,
			"all",
			"BeyondDiscoveryCap",
		);
		const content = await readComponent(
			projectRoot,
			"components/ui/component-259.tsx",
		);
		const matches = await searchComponents(
			projectRoot,
			"BeyondDiscoveryCap",
			"all",
		);

		expect(listedComponents).toHaveLength(250);
		expect(discoveryProbe).toHaveLength(251);
		expect(filteredComponents).toEqual([
			{
				path: "components/ui/component-259.tsx",
				area: "ui",
				exports: ["BeyondDiscoveryCap"],
			},
		]);
		expect(content).toContain("BeyondDiscoveryCap");
		expect(matches).toEqual([
			{
				path: "components/ui/component-259.tsx",
				line: 1,
				excerpt: "export function BeyondDiscoveryCap() { return null; }",
			},
		]);
	});

	it("does not expose a symlinked root entry point", async ({
		onTestFinished,
	}) => {
		const projectRoot = createTemporaryDirectory(
			"achromatic-mcp-root-",
			onTestFinished,
		);
		const outsideRoot = createTemporaryDirectory(
			"achromatic-mcp-outside-",
			onTestFinished,
		);
		await writeFile(join(outsideRoot, "proxy.ts"), "outside repository");
		await symlink(join(outsideRoot, "proxy.ts"), join(projectRoot, "proxy.ts"));

		await expect(
			listImplementationSources(projectRoot, "routes"),
		).resolves.not.toContainEqual({ path: "proxy.ts", area: "routes" });
	});
});
