import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
	getDatabaseSummary,
	getDatabaseWorkflow,
	parseDrizzleEnums,
	parseDrizzleTables,
} from "../../mcp/database";

const projectRoot = resolve(__dirname, "../..");

describe("Drizzle MCP database adapter", () => {
	it("parses the shipped table and enum source instead of hard-coding it", async () => {
		const [tablesSource, enumsSource] = await Promise.all([
			readFile(resolve(projectRoot, "lib/db/schema/tables.ts"), "utf8"),
			readFile(resolve(projectRoot, "lib/db/schema/enums.ts"), "utf8"),
		]);
		const tables = parseDrizzleTables(tablesSource);
		const enums = parseDrizzleEnums(enumsSource);
		const member = tables.find((table) => table.exportName === "memberTable");
		const user = tables.find((table) => table.exportName === "userTable");
		const tableDeclarations = [...tablesSource.matchAll(/=\s*pgTable\(/g)]
			.length;
		const enumDeclarations = [
			...enumsSource.matchAll(/^export const\s+\w+\s*=\s*\{/gm),
		].length;
		const constraintDeclarations = [
			...tablesSource.matchAll(
				/(?<!\.)\b(?:check|foreignKey|index|primaryKey|uniqueIndex)\(/g,
			),
		].length;

		expect(tables).toHaveLength(tableDeclarations);
		expect(enums).toHaveLength(enumDeclarations);
		expect(
			tables.reduce((total, table) => total + table.constraints.length, 0),
		).toBe(constraintDeclarations);
		expect(tables.map((table) => table.exportName)).toContain("userTable");
		expect(tables.map((table) => table.exportName)).toContain(
			"organizationTable",
		);
		expect(member?.fields.map((field) => field.name)).toContain(
			"organizationId",
		);
		expect(
			member?.fields.find((field) => field.name === "organizationId"),
		).toMatchObject({
			type: "uuid",
			databaseName: "organization_id",
			notNull: true,
			hasDefault: false,
			primaryKey: false,
			unique: false,
			references: "organizationTable.id",
		});
		expect(user?.fields.find((field) => field.name === "id")).toMatchObject({
			type: "uuid",
			databaseName: "id",
			notNull: true,
			hasDefault: true,
			primaryKey: true,
			unique: false,
		});
		expect(user?.fields.find((field) => field.name === "email")).toMatchObject({
			type: "text",
			databaseName: "email",
			notNull: true,
			hasDefault: false,
			primaryKey: false,
			unique: true,
		});
		expect(member?.constraints).toContainEqual({
			type: "uniqueIndex",
			name: "member_user_org_idx",
		});
		expect(enums.find((item) => item.name === "MemberRole")?.values).toEqual(
			expect.arrayContaining(["owner", "admin", "member"]),
		);
	});

	it("summarizes checked-in schema and SQL migrations", async () => {
		const summary = await getDatabaseSummary(projectRoot);

		expect(summary.orm).toBe("Drizzle");
		expect(summary.tables.length).toBeGreaterThan(10);
		expect(summary.migrations.length).toBeGreaterThan(0);
		expect(summary.migrationMetadata).toEqual(
			expect.arrayContaining([
				"lib/db/migrations/meta/_journal.json",
				expect.stringMatching(/_snapshot\.json$/),
			]),
		);
		expect(summary.migrations.every((path) => path.endsWith(".sql"))).toBe(
			true,
		);
	});

	it("distinguishes migration generation from production application", () => {
		const changeSchema = getDatabaseWorkflow("change-schema");
		const production = getDatabaseWorkflow("apply-production");

		expect(changeSchema.steps.join(" ")).toContain("db:generate");
		expect(changeSchema.steps.join(" ")).toContain("db:migrate");
		expect(production.steps.join(" ")).toContain("db:migrate");
		expect(production.steps.join(" ")).not.toContain("db:generate");
	});

	it("only recommends package scripts that the repository ships", async () => {
		const packageJson = JSON.parse(
			await readFile(resolve(projectRoot, "package.json"), "utf8"),
		) as { scripts: Record<string, string> };
		const availableScripts = new Set(Object.keys(packageJson.scripts));

		for (const workflow of [
			"apply-production",
			"change-schema",
			"inspect-data",
			"prototype",
		] as const) {
			const commands = getDatabaseWorkflow(workflow).steps.flatMap((step) =>
				[...step.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1]),
			);

			expect(commands.length).toBeGreaterThan(0);
			expect(
				commands.every((command) => command && availableScripts.has(command)),
			).toBe(true);
		}
	});
});
