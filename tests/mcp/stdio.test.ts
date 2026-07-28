import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "../..");

describe("Achromatic MCP stdio entry point", () => {
	it("starts through the documented npm command and completes discovery", async () => {
		const transport = new StdioClientTransport({
			command: process.platform === "win32" ? "npm.cmd" : "npm",
			args: ["run", "--silent", "mcp:start"],
			cwd: projectRoot,
			stderr: "pipe",
		});
		const client = new Client({
			name: "achromatic-mcp-stdio-test",
			version: "1.0.0",
		});
		let stderr = "";
		transport.stderr?.on("data", (chunk: Buffer | string) => {
			stderr += chunk.toString();
		});

		try {
			await client.connect(transport);
			const [tools, resources, prompts, overview, components] =
				await Promise.all([
					client.listTools(),
					client.listResources(),
					client.listPrompts(),
					client.callTool({
						name: "get_project_overview",
						arguments: {},
					}),
					client.callTool({
						name: "list_components",
						arguments: { area: "ui" },
					}),
				]);

			expect(tools.tools).toHaveLength(19);
			expect(
				tools.tools.every((tool) =>
					tool.outputSchema?.required?.includes("result"),
				),
			).toBe(true);
			expect(resources.resources).toHaveLength(3);
			expect(prompts.prompts).toHaveLength(2);
			expect(client.getInstructions()).toContain("get_project_overview");
			expect(client.getInstructions()).toContain("resultLimit.reached");
			expect(client.getInstructions()).toContain("tenant isolation");
			expect(components.structuredContent).toMatchObject({
				resultLimit: { limit: 250, reached: false },
			});
			expect(overview.structuredContent).toMatchObject({
				result: {
					name: "Achromatic Pro Drizzle",
					database: { orm: "Drizzle" },
				},
			});
			expect(JSON.stringify(overview)).toContain("Achromatic Pro Drizzle");
		} catch (error) {
			throw new Error(
				`The documented stdio command failed: ${
					error instanceof Error ? error.message : String(error)
				}\n${stderr}`,
			);
		} finally {
			await client.close();
		}
	}, 20_000);
});
