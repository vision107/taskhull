import { existsSync } from "node:fs";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import {
	dirname,
	extname,
	isAbsolute,
	relative,
	resolve,
	sep,
} from "node:path";

const MAX_TEXT_FILE_BYTES = 512_000;
export const DISCOVERY_RESULT_LIMIT = 250;
export const SEARCH_RESULT_LIMIT = 50;
const ROOT_DOCUMENTS = [
	"AGENTS.md",
	"CLAUDE.md",
	"README.md",
	"README_AI.md",
	"README_AUTH.md",
	"README_BILLING.md",
	"README_CONTENT.md",
	"README_DATABASE.md",
	"README_DEPLOYMENT.md",
	"README_EMAIL.md",
	"README_MCP.md",
	"README_OBSERVABILITY.md",
	"README_QUICKSTART.md",
	"README_STORAGE.md",
	"README_TRPC.md",
	"ROLES.md",
] as const;

export interface ComponentSummary {
	path: string;
	area: string;
	exports: string[];
}

export interface DocumentationSummary {
	path: string;
	title: string;
}

export type ImplementationArea =
	| "config"
	| "hooks"
	| "libraries"
	| "routes"
	| "schemas"
	| "trpc"
	| "types";

export interface ImplementationSourceSummary {
	path: string;
	area: ImplementationArea;
}

export interface SearchMatch {
	path: string;
	line: number;
	excerpt: string;
}

export interface ScriptSummary {
	name: string;
	command: string;
	category: ScriptCategory;
}

export type ScriptCategory =
	| "database"
	| "dependencies"
	| "development"
	| "quality"
	| "services"
	| "other";

function toPortablePath(path: string): string {
	return path.split(sep).join("/");
}

function isInside(parent: string, child: string): boolean {
	const pathFromParent = relative(parent, child);
	return (
		pathFromParent === "" ||
		(!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))
	);
}

function assertRelativePath(path: string): void {
	if (
		path.length === 0 ||
		isAbsolute(path) ||
		path.includes("\0") ||
		path.split(/[\\/]/).includes("..")
	) {
		throw new Error(`Invalid repository-relative path: ${path}`);
	}
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function getRealProjectRoot(projectRoot: string): Promise<string> {
	return realpath(resolve(projectRoot));
}

export function findProjectRoot(candidates: string[]): string {
	for (const candidate of candidates) {
		let current = resolve(candidate);

		while (true) {
			const packagePath = resolve(current, "package.json");
			const schemaPath = resolve(current, "lib/db/schema/index.ts");

			if (existsSync(packagePath) && existsSync(schemaPath)) {
				return current;
			}

			const parent = dirname(current);
			if (parent === current) {
				break;
			}
			current = parent;
		}
	}

	throw new Error(
		"Could not locate the Achromatic project root. Start the MCP server from the repository or rebuild it after moving the checkout.",
	);
}

export async function readKnownFile(
	projectRoot: string,
	path: string,
	allowedPaths: readonly string[],
): Promise<string> {
	assertRelativePath(path);

	const normalizedPath = toPortablePath(path);
	if (!allowedPaths.includes(normalizedPath)) {
		throw new Error(`File is not exposed by this MCP server: ${path}`);
	}

	const absolutePath = resolve(projectRoot, normalizedPath);
	if (!isInside(projectRoot, absolutePath)) {
		throw new Error(`File resolves outside the project root: ${path}`);
	}

	const requestedPathStats = await lstat(absolutePath);
	if (requestedPathStats.isSymbolicLink()) {
		throw new Error(`Path is not a file: ${path}`);
	}
	const [realProjectRoot, realFilePath] = await Promise.all([
		getRealProjectRoot(projectRoot),
		realpath(absolutePath),
	]);
	if (!isInside(realProjectRoot, realFilePath)) {
		throw new Error(`File resolves outside the project root: ${path}`);
	}

	const fileStats = await lstat(realFilePath);
	if (!fileStats.isFile()) {
		throw new Error(`Path is not a file: ${path}`);
	}
	if (fileStats.size > MAX_TEXT_FILE_BYTES) {
		throw new Error(
			`File is too large to expose safely (${fileStats.size} bytes): ${path}`,
		);
	}

	return readFile(realFilePath, "utf8");
}

export async function listKnownFiles(
	projectRoot: string,
	relativeDirectory: string,
	extensions: ReadonlySet<string>,
): Promise<string[]> {
	const absoluteDirectory = resolve(projectRoot, relativeDirectory);
	if (
		!isInside(projectRoot, absoluteDirectory) ||
		!(await pathExists(absoluteDirectory))
	) {
		return [];
	}
	const directoryStats = await lstat(absoluteDirectory);
	if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
		return [];
	}
	const [realProjectRoot, realDirectory] = await Promise.all([
		getRealProjectRoot(projectRoot),
		realpath(absoluteDirectory),
	]);
	if (!isInside(realProjectRoot, realDirectory)) {
		return [];
	}

	const files: string[] = [];

	async function visit(absolutePath: string): Promise<void> {
		const entries = await readdir(absolutePath, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));

		for (const entry of entries) {
			if (entry.isSymbolicLink()) {
				continue;
			}

			const entryPath = resolve(absolutePath, entry.name);
			if (!isInside(absoluteDirectory, entryPath)) {
				continue;
			}

			if (entry.isDirectory()) {
				await visit(entryPath);
			} else if (entry.isFile() && extensions.has(extname(entry.name))) {
				files.push(toPortablePath(relative(projectRoot, entryPath)));
			}
		}
	}

	await visit(absoluteDirectory);
	return files;
}

function getMarkdownTitle(path: string, content: string): string {
	const frontmatterTitle = content.match(
		/^---[\s\S]*?^title:\s*["']?(.+?)["']?\s*$[\s\S]*?^---/m,
	)?.[1];
	if (frontmatterTitle) {
		return frontmatterTitle.trim();
	}

	const heading = content.match(/^#\s+(.+)$/m)?.[1];
	return (
		heading?.trim() ??
		path
			.split("/")
			.at(-1)
			?.replace(/\.(md|mdx)$/i, "") ??
		path
	);
}

export async function listDocumentation(
	projectRoot: string,
): Promise<DocumentationSummary[]> {
	const contentDocuments = await listKnownFiles(
		projectRoot,
		"content/docs",
		new Set([".md", ".mdx"]),
	);
	const existingRootDocuments: string[] = [];

	for (const path of ROOT_DOCUMENTS) {
		if (await pathExists(resolve(projectRoot, path))) {
			existingRootDocuments.push(path);
		}
	}

	const paths = [...existingRootDocuments, ...contentDocuments];
	const summaries = await Promise.all(
		paths.map(async (path) => ({
			path,
			title: getMarkdownTitle(
				path,
				await readKnownFile(projectRoot, path, paths),
			),
		})),
	);

	return summaries.sort((left, right) => left.path.localeCompare(right.path));
}

export async function searchDocumentation(
	projectRoot: string,
	query: string,
	resultLimit = SEARCH_RESULT_LIMIT,
): Promise<SearchMatch[]> {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (normalizedQuery.length < 2) {
		throw new Error("Documentation searches require at least two characters.");
	}

	const documents = await listDocumentation(projectRoot);
	const allowedPaths = documents.map((document) => document.path);
	const matches: SearchMatch[] = [];

	for (const document of documents) {
		const content = await readKnownFile(
			projectRoot,
			document.path,
			allowedPaths,
		);
		for (const [index, line] of content.split(/\r?\n/).entries()) {
			if (!line.toLocaleLowerCase().includes(normalizedQuery)) {
				continue;
			}

			matches.push({
				path: document.path,
				line: index + 1,
				excerpt: line.trim().slice(0, 240),
			});
			if (matches.length >= resultLimit) {
				return matches;
			}
		}
	}

	return matches;
}

function getExportNames(content: string): string[] {
	const names = new Set<string>();
	const patterns = [
		/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
		/export\s+(?:declare\s+)?(?:const|class|let|var)\s+([A-Za-z_$][\w$]*)/g,
	];

	for (const pattern of patterns) {
		for (const match of content.matchAll(pattern)) {
			if (match[1]) {
				names.add(match[1]);
			}
		}
	}

	for (const match of content.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
		for (const specifier of (match[1] ?? "").split(",")) {
			const normalizedSpecifier = specifier
				.trim()
				.replace(/^type\s+/, "")
				.split(/\s+as\s+/)
				.at(-1);
			if (normalizedSpecifier?.match(/^[A-Za-z_$][\w$]*$/)) {
				names.add(normalizedSpecifier);
			}
		}
	}

	if (/export\s+default\s+/m.test(content)) {
		names.add("default");
	}

	return [...names].sort();
}

async function listComponentPaths(
	projectRoot: string,
	area: "all" | "feature" | "ui",
): Promise<string[]> {
	const paths = await listKnownFiles(
		projectRoot,
		"components",
		new Set([".ts", ".tsx"]),
	);

	return paths.filter((path) => {
		const isUiComponent = path.startsWith("components/ui/");
		return !(
			(area === "ui" && !isUiComponent) ||
			(area === "feature" && isUiComponent)
		);
	});
}

async function discoverComponents(
	projectRoot: string,
	area: "all" | "feature" | "ui",
	query?: string,
): Promise<ComponentSummary[]> {
	const paths = await listComponentPaths(projectRoot, area);
	const normalizedQuery = query?.trim().toLocaleLowerCase();
	const summaries: ComponentSummary[] = [];

	for (const path of paths) {
		const isUiComponent = path.startsWith("components/ui/");
		const content = await readKnownFile(projectRoot, path, paths);
		const exports = getExportNames(content);
		if (
			normalizedQuery &&
			!path.toLocaleLowerCase().includes(normalizedQuery) &&
			!exports.some((name) =>
				name.toLocaleLowerCase().includes(normalizedQuery),
			)
		) {
			continue;
		}

		const relativeComponentPath = path.replace(/^components\//, "");
		summaries.push({
			path,
			area: isUiComponent
				? "ui"
				: (relativeComponentPath.split("/")[0] ?? "other"),
			exports,
		});
	}

	return summaries;
}

export async function listComponents(
	projectRoot: string,
	area: "all" | "feature" | "ui",
	query?: string,
	resultLimit = DISCOVERY_RESULT_LIMIT,
): Promise<ComponentSummary[]> {
	return (await discoverComponents(projectRoot, area, query)).slice(
		0,
		resultLimit,
	);
}

export async function searchComponents(
	projectRoot: string,
	query: string,
	area: "all" | "feature" | "ui",
	resultLimit = SEARCH_RESULT_LIMIT,
): Promise<SearchMatch[]> {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (normalizedQuery.length < 2) {
		throw new Error("Component searches require at least two characters.");
	}

	const allowedPaths = await listComponentPaths(projectRoot, area);
	const matches: SearchMatch[] = [];

	for (const path of allowedPaths) {
		const content = await readKnownFile(projectRoot, path, allowedPaths);
		for (const [index, line] of content.split(/\r?\n/).entries()) {
			if (!line.toLocaleLowerCase().includes(normalizedQuery)) {
				continue;
			}

			matches.push({
				path,
				line: index + 1,
				excerpt: line.trim().slice(0, 240),
			});
			if (matches.length >= resultLimit) {
				return matches;
			}
		}
	}

	return matches;
}

export async function readComponent(
	projectRoot: string,
	path: string,
): Promise<string> {
	const allowedPaths = await listComponentPaths(projectRoot, "all");
	return readKnownFile(projectRoot, path, allowedPaths);
}

const IMPLEMENTATION_ROOTS: Record<ImplementationArea, string> = {
	config: "config",
	hooks: "hooks",
	libraries: "lib",
	routes: "app",
	schemas: "schemas",
	trpc: "trpc",
	types: "types",
};
const ROOT_IMPLEMENTATION_SOURCES: ImplementationSourceSummary[] = [
	{ path: "content-collections.ts", area: "config" },
	{ path: "drizzle.config.ts", area: "config" },
	{ path: "instrumentation-client.ts", area: "libraries" },
	{ path: "instrumentation-edge.ts", area: "libraries" },
	{ path: "instrumentation-server.ts", area: "libraries" },
	{ path: "instrumentation.ts", area: "libraries" },
	{ path: "next.config.ts", area: "config" },
	{ path: "playwright.config.ts", area: "config" },
	{ path: "prisma.config.ts", area: "config" },
	{ path: "proxy.ts", area: "routes" },
	{ path: "source.config.ts", area: "config" },
];

async function discoverImplementationSources(
	projectRoot: string,
	area: "all" | ImplementationArea,
	query?: string,
): Promise<ImplementationSourceSummary[]> {
	const requestedAreas = (
		area === "all" ? Object.keys(IMPLEMENTATION_ROOTS) : [area]
	) as ImplementationArea[];
	const normalizedQuery = query?.trim().toLocaleLowerCase();
	const sources: ImplementationSourceSummary[] = [];

	for (const source of ROOT_IMPLEMENTATION_SOURCES) {
		if (
			!requestedAreas.includes(source.area) ||
			(normalizedQuery &&
				!source.path.toLocaleLowerCase().includes(normalizedQuery))
		) {
			continue;
		}
		try {
			await readKnownFile(projectRoot, source.path, [source.path]);
			sources.push(source);
		} catch {
			// Ignore optional root entry points that are not present.
		}
	}

	for (const requestedArea of requestedAreas) {
		const paths = await listKnownFiles(
			projectRoot,
			IMPLEMENTATION_ROOTS[requestedArea],
			new Set([".ts", ".tsx"]),
		);

		for (const path of paths) {
			if (
				normalizedQuery &&
				!path.toLocaleLowerCase().includes(normalizedQuery)
			) {
				continue;
			}
			sources.push({ path, area: requestedArea });
		}
	}

	return sources.sort((left, right) => left.path.localeCompare(right.path));
}

export async function listImplementationSources(
	projectRoot: string,
	area: "all" | ImplementationArea,
	query?: string,
	resultLimit = DISCOVERY_RESULT_LIMIT,
): Promise<ImplementationSourceSummary[]> {
	return (await discoverImplementationSources(projectRoot, area, query)).slice(
		0,
		resultLimit,
	);
}

export async function readImplementationSource(
	projectRoot: string,
	path: string,
): Promise<string> {
	const sources = await discoverImplementationSources(projectRoot, "all");
	return readKnownFile(
		projectRoot,
		path,
		sources.map((source) => source.path),
	);
}

export async function searchImplementationSources(
	projectRoot: string,
	query: string,
	area: "all" | ImplementationArea,
	resultLimit = SEARCH_RESULT_LIMIT,
): Promise<SearchMatch[]> {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	if (normalizedQuery.length < 2) {
		throw new Error("Implementation searches require at least two characters.");
	}

	const sources = await discoverImplementationSources(projectRoot, area);
	const allowedPaths = sources.map((source) => source.path);
	const matches: SearchMatch[] = [];

	for (const source of sources) {
		const content = await readKnownFile(projectRoot, source.path, allowedPaths);
		for (const [index, line] of content.split(/\r?\n/).entries()) {
			if (!line.toLocaleLowerCase().includes(normalizedQuery)) {
				continue;
			}

			matches.push({
				path: source.path,
				line: index + 1,
				excerpt: line.trim().slice(0, 240),
			});

			if (matches.length >= resultLimit) {
				return matches;
			}
		}
	}

	return matches;
}

function getScriptCategory(name: string): ScriptCategory {
	if (name.startsWith("db:")) return "database";
	if (
		name === "check" ||
		name === "check:write" ||
		name.startsWith("e2e") ||
		name.startsWith("format") ||
		name.startsWith("lint") ||
		name.startsWith("test") ||
		name === "typecheck"
	) {
		return "quality";
	}
	if (
		name.startsWith("docker:") ||
		name.startsWith("email:") ||
		name.startsWith("stripe:")
	) {
		return "services";
	}
	if (
		name.startsWith("deps:") ||
		name === "postinstall" ||
		name === "prepare"
	) {
		return "dependencies";
	}
	if (
		name === "build" ||
		name === "clean" ||
		name === "deploy" ||
		name === "dev" ||
		name === "start"
	) {
		return "development";
	}
	return "other";
}

export async function listScripts(
	projectRoot: string,
): Promise<ScriptSummary[]> {
	const packageJson = JSON.parse(
		await readKnownFile(projectRoot, "package.json", ["package.json"]),
	) as unknown;
	if (
		typeof packageJson !== "object" ||
		packageJson === null ||
		!("scripts" in packageJson) ||
		typeof packageJson.scripts !== "object" ||
		packageJson.scripts === null
	) {
		return [];
	}

	return Object.entries(packageJson.scripts)
		.filter((entry): entry is [string, string] => typeof entry[1] === "string")
		.map(([name, command]) => ({
			name,
			command,
			category: getScriptCategory(name),
		}))
		.sort((left, right) => left.name.localeCompare(right.name));
}

export async function getPackageVersions(
	projectRoot: string,
	packageNames: readonly string[],
): Promise<Record<string, string>> {
	const packageJson = JSON.parse(
		await readKnownFile(projectRoot, "package.json", ["package.json"]),
	) as unknown;
	if (typeof packageJson !== "object" || packageJson === null) {
		return {};
	}
	const manifest = packageJson as Record<string, unknown>;
	const versions: Record<string, string> = {};

	for (const packageName of packageNames) {
		for (const group of ["dependencies", "devDependencies"] as const) {
			const dependencies = manifest[group];
			if (
				typeof dependencies === "object" &&
				dependencies !== null &&
				packageName in dependencies
			) {
				const version = (dependencies as Record<string, unknown>)[packageName];
				if (typeof version === "string") {
					versions[packageName] = version;
				}
				break;
			}
		}
	}

	return versions;
}

export async function getHealthcheck(
	projectRoot: string,
): Promise<{ command: string; purpose: string }[]> {
	const scripts = new Set(
		(await listScripts(projectRoot)).map((script) => script.name),
	);
	const preferredChecks = [
		["typecheck", "Validate TypeScript across the application and MCP server."],
		["lint", "Run Oxlint, including type-aware project rules."],
		["format", "Check formatting without changing files."],
		["test", "Run the unit test suite, including MCP contract tests."],
		["mcp:build", "Compile the local MCP server."],
		["build", "Create the production Next.js build."],
	] as const;

	return preferredChecks
		.filter(([script]) => scripts.has(script))
		.map(([script, purpose]) => ({
			command: `npm run ${script}`,
			purpose,
		}));
}
