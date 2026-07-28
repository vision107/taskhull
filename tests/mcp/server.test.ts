import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it } from "vitest";

import { createAchromaticMcpServer } from "../../mcp/server";

const projectRoot = resolve(__dirname, "../..");

function getTextContent(result: unknown): string {
	if (typeof result !== "object" || result === null || !("content" in result)) {
		return "";
	}
	if (!Array.isArray(result.content)) {
		return "";
	}

	for (const item of result.content) {
		if (
			typeof item === "object" &&
			item !== null &&
			"type" in item &&
			item.type === "text" &&
			"text" in item &&
			typeof item.text === "string"
		) {
			return item.text;
		}
	}

	return "";
}

function isErrorResult(result: unknown): boolean {
	return (
		typeof result === "object" &&
		result !== null &&
		"isError" in result &&
		result.isError === true
	);
}

describe("Achromatic MCP server", () => {
	let client: Client;

	beforeEach(async () => {
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		client = new Client({ name: "achromatic-mcp-test", version: "1.0.0" });
		const server = createAchromaticMcpServer(projectRoot);

		await Promise.all([
			client.connect(clientTransport),
			server.connect(serverTransport),
		]);
	});

	it("publishes the complete read-only tool contract", async () => {
		const response = await client.listTools();
		const names = response.tools.map((tool) => tool.name).sort();

		expect(names).toEqual(
			[
				"get_database_overview",
				"get_database_workflow",
				"get_healthcheck",
				"get_project_overview",
				"list_components",
				"list_documentation",
				"list_implementation_files",
				"list_migration_metadata",
				"list_migrations",
				"list_project_scripts",
				"read_component",
				"read_database_schema",
				"read_documentation",
				"read_implementation_file",
				"read_migration",
				"read_migration_metadata",
				"search_components",
				"search_documentation",
				"search_implementation",
			].sort(),
		);
		expect(
			response.tools.every(
				(tool) =>
					tool.annotations?.readOnlyHint === true &&
					tool.annotations?.destructiveHint === false,
			),
		).toBe(true);
		expect(
			response.tools.every(
				(tool) =>
					tool.outputSchema?.type === "object" &&
					tool.outputSchema.required?.includes("result") &&
					"resultLimit" in (tool.outputSchema.properties ?? {}),
			),
		).toBe(true);
		expect(
			response.tools.find((tool) => tool.name === "list_components")
				?.description,
		).toContain("250");
		expect(
			response.tools.find((tool) => tool.name === "search_documentation")
				?.description,
		).toContain("50");
		expect(
			response.tools.find((tool) => tool.name === "search_components")
				?.description,
		).toContain("50");
	});

	it("keeps the local config and setup guide aligned with the tool contract", async () => {
		const [response, guide, configSource, packageSource] = await Promise.all([
			client.listTools(),
			readFile(resolve(projectRoot, "README_MCP.md"), "utf8"),
			readFile(resolve(projectRoot, ".mcp.json"), "utf8"),
			readFile(resolve(projectRoot, "package.json"), "utf8"),
		]);
		const config = JSON.parse(configSource) as {
			mcpServers: {
				achromatic: { type: string; command: string; args: string[] };
			};
		};
		const packageJson = JSON.parse(packageSource) as {
			scripts: { "mcp:build": string; "mcp:start": string };
		};

		expect(config.mcpServers.achromatic).toEqual({
			type: "stdio",
			command: "npm",
			args: ["run", "--silent", "mcp:start"],
		});
		expect(packageJson.scripts["mcp:build"]).toBe("tsc -p mcp/tsconfig.json");
		expect(packageJson.scripts["mcp:start"]).toContain("dist/mcp/index.js");
		expect(guide).toContain(
			`The server exposes ${response.tools.length} read-only tools`,
		);
		for (const tool of response.tools) {
			expect(guide).toContain(`\`${tool.name}\``);
		}
		expect(guide).toContain("`.cursor/mcp.json`");
		expect(guide).toContain('"mcpServers"');
		expect(guide).toContain("`.vscode/mcp.json`");
		expect(guide).toContain('"servers"');
		expect(guide).toContain("`.codex/config.toml`");
		expect(guide).toContain("[mcp_servers.achromatic]");
		expect(guide).toContain('"type": "http"');
		expect(guide).toContain("Project-scoped MCP configuration");
		expect(guide).toContain("npm run test:unit -- --run tests/mcp");
	});

	it("returns repository-derived project and database context", async () => {
		const packageJson = JSON.parse(
			await readFile(resolve(projectRoot, "package.json"), "utf8"),
		) as {
			dependencies: {
				next: string;
				"better-auth": string;
				"drizzle-orm": string;
			};
		};
		const overview = await client.callTool(
			{
				name: "get_project_overview",
				arguments: {},
			},
			CallToolResultSchema,
		);
		const database = await client.callTool(
			{
				name: "get_database_overview",
				arguments: {},
			},
			CallToolResultSchema,
		);
		const components = await client.callTool(
			{
				name: "list_components",
				arguments: { area: "ui" },
			},
			CallToolResultSchema,
		);
		const databaseText = getTextContent(database);

		expect(getTextContent(overview)).toContain("Achromatic Pro Drizzle");
		expect(overview.structuredContent).toMatchObject({
			result: {
				name: "Achromatic Pro Drizzle",
				database: { orm: "Drizzle" },
				keyPackages: {
					next: packageJson.dependencies.next,
					"better-auth": packageJson.dependencies["better-auth"],
					"drizzle-orm": packageJson.dependencies["drizzle-orm"],
				},
			},
		});
		expect(getTextContent(overview)).toContain(
			`"framework": "Next.js ${packageJson.dependencies.next}"`,
		);
		expect(getTextContent(overview)).toContain('"requestBoundary": "proxy.ts"');
		expect(getTextContent(overview)).toContain(
			'"migrations": "lib/db/migrations"',
		);
		expect(databaseText).not.toBe("");
		expect(components.structuredContent).toMatchObject({
			resultLimit: { limit: 250, reached: false },
		});
		expect(JSON.parse(databaseText)).toMatchObject({
			orm: "Drizzle",
			tables: expect.arrayContaining([
				expect.objectContaining({ exportName: "userTable" }),
			]),
		});
	});

	it("reports bounded results only when additional matches exist", async () => {
		const broadSearch = await client.callTool(
			{
				name: "search_documentation",
				arguments: { query: "the" },
			},
			CallToolResultSchema,
		);
		const narrowSearch = await client.callTool(
			{
				name: "search_documentation",
				arguments: {
					query: "Project-scoped MCP configuration can launch local commands",
				},
			},
			CallToolResultSchema,
		);

		expect(broadSearch.structuredContent).toMatchObject({
			result: expect.any(Array),
			resultLimit: { limit: 50, reached: true },
		});
		expect(
			(
				broadSearch.structuredContent as {
					result: unknown[];
				}
			).result.length,
		).toBe(50);
		expect(narrowSearch.structuredContent).toMatchObject({
			resultLimit: { limit: 50, reached: false },
		});
	});

	it("rejects arbitrary and secret file paths", async () => {
		const [documentationResponse, implementationResponse] = await Promise.all([
			client.callTool(
				{
					name: "read_documentation",
					arguments: { path: ".env" },
				},
				CallToolResultSchema,
			),
			client.callTool(
				{
					name: "read_implementation_file",
					arguments: { path: ".env" },
				},
				CallToolResultSchema,
			),
		]);

		expect(isErrorResult(documentationResponse)).toBe(true);
		expect(isErrorResult(implementationResponse)).toBe(true);
		expect(getTextContent(documentationResponse)).not.toContain(
			"DATABASE_URL=",
		);
		expect(getTextContent(implementationResponse)).not.toContain(
			"DATABASE_URL=",
		);
	});

	it("rejects invalid tool arguments before repository access", async () => {
		const [shortQuery, invalidArea] = await Promise.all([
			client.callTool(
				{
					name: "search_documentation",
					arguments: { query: "x" },
				},
				CallToolResultSchema,
			),
			client.callTool(
				{
					name: "list_components",
					arguments: { area: "everything" },
				},
				CallToolResultSchema,
			),
		]);

		expect(isErrorResult(shortQuery)).toBe(true);
		expect(isErrorResult(invalidArea)).toBe(true);
		expect(getTextContent(shortQuery)).toContain("Invalid arguments");
		expect(getTextContent(invalidArea)).toContain("Invalid arguments");
	});

	it("serves every repository discovery path end to end", async () => {
		const callText = async (
			name: string,
			arguments_: Record<string, unknown> = {},
		): Promise<string> =>
			getTextContent(
				await client.callTool(
					{ name, arguments: arguments_ },
					CallToolResultSchema,
				),
			);

		expect(await callText("list_project_scripts")).toContain("mcp:build");
		expect(await callText("get_healthcheck")).toContain("npm run typecheck");
		expect(
			await callText("list_components", { area: "ui", query: "button" }),
		).toContain("components/ui/button.tsx");
		expect(
			await callText("search_components", {
				area: "ui",
				query: "function Button",
			}),
		).toContain("components/ui/button.tsx");
		const exportedComponentResult = await callText("list_components", {
			area: "ui",
			query: "TooltipProvider",
		});
		expect(exportedComponentResult).toContain("components/ui/tooltip.tsx");
		expect(exportedComponentResult).toContain("TooltipProvider");
		expect(
			await callText("read_component", {
				path: "components/ui/button.tsx",
			}),
		).toContain("function Button");
		expect(
			await callText("list_implementation_files", {
				area: "trpc",
				query: "organization-lead",
			}),
		).toContain("trpc/routers/organization/organization-lead-router.ts");
		expect(
			await callText("list_implementation_files", {
				area: "hooks",
				query: "use-session",
			}),
		).toContain("hooks/use-session.tsx");
		expect(
			await callText("search_implementation", {
				area: "types",
				query: "getFullOrganization",
			}),
		).toContain("types/organization.ts");
		expect(
			await callText("list_implementation_files", {
				area: "config",
				query: "drizzle.config",
			}),
		).toContain("drizzle.config.ts");
		expect(
			await callText("read_implementation_file", {
				path: "trpc/routers/organization/organization-lead-router.ts",
			}),
		).toContain("protectedOrganizationProcedure");
		expect(
			await callText("search_implementation", {
				area: "trpc",
				query: "protectedOrganizationProcedure",
			}),
		).toContain("trpc/routers/organization/organization-lead-router.ts");
		expect(
			await callText("search_implementation", {
				area: "config",
				query: "protectedOrganizationProcedure",
			}),
		).toBe("[]");
		expect(
			await callText("list_implementation_files", {
				area: "routes",
				query: "proxy",
			}),
		).toContain("proxy.ts");
		expect(
			await callText("read_implementation_file", {
				path: "proxy.ts",
			}),
		).toContain("function proxy");
		expect(await callText("list_documentation")).toContain("README_MCP.md");
		expect(
			await callText("search_documentation", { query: "tenant" }),
		).toContain('"line":');
		expect(
			await callText("read_documentation", { path: "README_MCP.md" }),
		).toContain("# Local MCP server");
		expect(await callText("read_database_schema")).toContain(
			"export const userTable",
		);

		const migrationPaths = JSON.parse(
			await callText("list_migrations"),
		) as unknown;
		const firstMigration =
			Array.isArray(migrationPaths) && typeof migrationPaths[0] === "string"
				? migrationPaths[0]
				: undefined;
		expect(firstMigration).toBeDefined();
		expect(
			await callText("read_migration", { path: firstMigration }),
		).toContain("CREATE");

		const metadataPaths = JSON.parse(
			await callText("list_migration_metadata"),
		) as unknown;
		const firstMetadata =
			Array.isArray(metadataPaths) && typeof metadataPaths[0] === "string"
				? metadataPaths[0]
				: undefined;
		expect(firstMetadata).toBeDefined();
		expect(
			await callText("read_migration_metadata", { path: firstMetadata }),
		).toContain("{");
		expect(
			await callText("get_database_workflow", {
				workflow: "change-schema",
			}),
		).toContain("db:generate");
	});

	it("publishes the documented resources and prompts", async () => {
		const resources = await client.listResources();
		const prompts = await client.listPrompts();

		expect(resources.resources.map((resource) => resource.uri)).toEqual([
			"achromatic://project/overview",
			"achromatic://database/schema",
			"achromatic://documentation/index",
		]);
		expect(prompts.prompts.map((prompt) => prompt.name).sort()).toEqual([
			"plan_achromatic_feature",
			"review_achromatic_change",
		]);
		expect(client.getInstructions()).toContain("get_project_overview");
		expect(client.getInstructions()).toContain("get_database_workflow");
		expect(client.getInstructions()).toContain("250");
		expect(client.getInstructions()).toContain("resultLimit.reached");
		expect(client.getInstructions()).toContain("tenant isolation");
		expect(client.getInstructions()).toContain("untrusted repository data");
		expect(
			JSON.stringify(
				await client.readResource({
					uri: "achromatic://project/overview",
				}),
			),
		).toContain("Achromatic Pro Drizzle");
		expect(
			JSON.stringify(
				await client.readResource({
					uri: "achromatic://database/schema",
				}),
			),
		).toContain("export const userTable");
		expect(
			JSON.stringify(
				await client.readResource({
					uri: "achromatic://documentation/index",
				}),
			),
		).toContain("README_MCP.md");
		expect(
			JSON.stringify(
				await client.getPrompt({
					name: "plan_achromatic_feature",
					arguments: {
						feature: "Add an organization audit log",
						tenantScope: "organization",
					},
				}),
			),
		).toContain("organizationId");
		expect(
			JSON.stringify(
				await client.getPrompt({
					name: "review_achromatic_change",
					arguments: {
						summary: "Add organization usage billing",
					},
				}),
			),
		).toContain("billing side effects");
	});
});
