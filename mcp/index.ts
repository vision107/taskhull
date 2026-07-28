#!/usr/bin/env node

import { resolve } from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { findProjectRoot } from "./repository.js";
import { createAchromaticMcpServer } from "./server.js";

async function main(): Promise<void> {
	const projectRoot = findProjectRoot([
		process.cwd(),
		resolve(__dirname, "../.."),
		resolve(__dirname, ".."),
	]);
	const server = createAchromaticMcpServer(projectRoot);
	const transport = new StdioServerTransport();

	await server.connect(transport);
	console.error("Achromatic Pro Drizzle MCP server running on stdio.");
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Achromatic MCP server failed: ${message}`);
	process.exit(1);
});
