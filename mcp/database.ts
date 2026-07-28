import ts from "typescript";

import { listKnownFiles, readKnownFile } from "./repository.js";

const SCHEMA_FILES = [
	"lib/db/schema/enums.ts",
	"lib/db/schema/index.ts",
	"lib/db/schema/relations.ts",
	"lib/db/schema/tables.ts",
] as const;
const MIGRATIONS_PATH = "lib/db/migrations";
const MIGRATION_METADATA_PATH = "lib/db/migrations/meta";

export type DatabaseWorkflow =
	| "apply-production"
	| "change-schema"
	| "inspect-data"
	| "prototype";

export interface DrizzleEnum {
	name: string;
	values: string[];
}

export interface DrizzleField {
	name: string;
	type: string;
	databaseName?: string;
	notNull: boolean;
	hasDefault: boolean;
	primaryKey: boolean;
	unique: boolean;
	references?: string;
}

export interface DrizzleConstraint {
	type: "check" | "foreignKey" | "index" | "primaryKey" | "uniqueIndex";
	name: string;
}

export interface DrizzleTable {
	exportName: string;
	databaseName: string;
	fields: DrizzleField[];
	constraints: DrizzleConstraint[];
}

export interface DatabaseSummary {
	orm: "Drizzle";
	schemaFiles: string[];
	tables: DrizzleTable[];
	enums: DrizzleEnum[];
	migrations: string[];
	migrationMetadata: string[];
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
	if (
		ts.isAsExpression(expression) ||
		ts.isParenthesizedExpression(expression) ||
		ts.isSatisfiesExpression(expression)
	) {
		return unwrapExpression(expression.expression);
	}

	return expression;
}

function getBuilderName(expression: ts.Expression): string {
	const current = unwrapExpression(expression);

	if (ts.isCallExpression(current)) {
		return getBuilderName(current.expression);
	}
	if (ts.isPropertyAccessExpression(current)) {
		return getBuilderName(current.expression);
	}
	if (ts.isIdentifier(current)) {
		return current.text;
	}

	return "unknown";
}

interface BuilderDetails {
	baseCall?: ts.CallExpression;
	methodCalls: Map<string, ts.CallExpression>;
}

function getBuilderDetails(expression: ts.Expression): BuilderDetails {
	const current = unwrapExpression(expression);

	if (!ts.isCallExpression(current)) {
		return { methodCalls: new Map() };
	}

	const callee = unwrapExpression(current.expression);
	if (ts.isIdentifier(callee)) {
		return {
			baseCall: current,
			methodCalls: new Map(),
		};
	}
	if (!ts.isPropertyAccessExpression(callee)) {
		return { methodCalls: new Map() };
	}

	const details = getBuilderDetails(callee.expression);
	details.methodCalls.set(callee.name.text, current);
	return details;
}

function getReferenceTarget(
	call: ts.CallExpression | undefined,
	source: ts.SourceFile,
): string | undefined {
	const reference = call?.arguments[0];
	if (!reference || !ts.isArrowFunction(reference)) {
		return undefined;
	}

	const body = ts.isBlock(reference.body)
		? reference.body.statements.find(ts.isReturnStatement)?.expression
		: reference.body;
	if (!body) {
		return undefined;
	}

	return unwrapExpression(body).getText(source);
}

function getPropertyName(name: ts.PropertyName): string | undefined {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
		return name.text;
	}

	return undefined;
}

const CONSTRAINT_BUILDERS = new Set<DrizzleConstraint["type"]>([
	"check",
	"foreignKey",
	"index",
	"primaryKey",
	"uniqueIndex",
]);

function findConstraintCall(
	expression: ts.Expression,
): ts.CallExpression | undefined {
	const current = unwrapExpression(expression);

	if (ts.isCallExpression(current)) {
		const callee = unwrapExpression(current.expression);
		if (
			ts.isIdentifier(callee) &&
			CONSTRAINT_BUILDERS.has(callee.text as DrizzleConstraint["type"])
		) {
			return current;
		}
		return findConstraintCall(current.expression);
	}
	if (ts.isPropertyAccessExpression(current)) {
		return findConstraintCall(current.expression);
	}

	return undefined;
}

function getConstraintExpressions(
	expression: ts.Expression | ts.ConciseBody,
): readonly ts.Expression[] {
	const current = ts.isExpression(expression)
		? unwrapExpression(expression)
		: expression;
	if (ts.isArrayLiteralExpression(current)) {
		return current.elements;
	}
	if (!ts.isBlock(current)) {
		return [];
	}

	for (const statement of current.statements) {
		if (
			ts.isReturnStatement(statement) &&
			statement.expression &&
			ts.isArrayLiteralExpression(unwrapExpression(statement.expression))
		) {
			return (
				unwrapExpression(statement.expression) as ts.ArrayLiteralExpression
			).elements;
		}
	}

	return [];
}

function parseTableConstraints(
	expression: ts.Expression | undefined,
): DrizzleConstraint[] {
	if (
		!expression ||
		(!ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression))
	) {
		return [];
	}

	return getConstraintExpressions(expression.body).flatMap((item) => {
		const call = findConstraintCall(item);
		const builder = call && unwrapExpression(call.expression);
		const name = call?.arguments[0];
		if (
			!call ||
			!builder ||
			!ts.isIdentifier(builder) ||
			!CONSTRAINT_BUILDERS.has(builder.text as DrizzleConstraint["type"]) ||
			!name ||
			!ts.isStringLiteral(name)
		) {
			return [];
		}

		return [
			{
				type: builder.text as DrizzleConstraint["type"],
				name: name.text,
			},
		];
	});
}

export function parseDrizzleTables(sourceText: string): DrizzleTable[] {
	const source = ts.createSourceFile(
		"tables.ts",
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const tables: DrizzleTable[] = [];

	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
				continue;
			}

			const initializer = unwrapExpression(declaration.initializer);
			if (
				!ts.isCallExpression(initializer) ||
				!ts.isIdentifier(initializer.expression) ||
				initializer.expression.text !== "pgTable"
			) {
				continue;
			}

			const databaseNameArgument = initializer.arguments[0];
			const fieldsArgument = initializer.arguments[1];
			const constraintsArgument = initializer.arguments[2];
			if (
				!databaseNameArgument ||
				!ts.isStringLiteral(databaseNameArgument) ||
				!fieldsArgument ||
				!ts.isObjectLiteralExpression(fieldsArgument)
			) {
				continue;
			}

			const fields = fieldsArgument.properties.flatMap((property) => {
				if (!ts.isPropertyAssignment(property)) {
					return [];
				}

				const name = getPropertyName(property.name);
				if (!name) {
					return [];
				}

				const details = getBuilderDetails(property.initializer);
				const databaseNameArgument = details.baseCall?.arguments[0];
				const primaryKey = details.methodCalls.has("primaryKey");

				return [
					{
						name,
						type: getBuilderName(property.initializer),
						databaseName:
							databaseNameArgument && ts.isStringLiteral(databaseNameArgument)
								? databaseNameArgument.text
								: undefined,
						notNull: primaryKey || details.methodCalls.has("notNull"),
						hasDefault: [...details.methodCalls.keys()].some(
							(method) =>
								method === "default" ||
								method === "defaultNow" ||
								method === "defaultRandom" ||
								method === "$default" ||
								method === "$defaultFn",
						),
						primaryKey,
						unique: details.methodCalls.has("unique"),
						references: getReferenceTarget(
							details.methodCalls.get("references"),
							source,
						),
					},
				];
			});

			tables.push({
				exportName: declaration.name.text,
				databaseName: databaseNameArgument.text,
				fields,
				constraints: parseTableConstraints(constraintsArgument),
			});
		}
	}

	return tables.sort((left, right) =>
		left.exportName.localeCompare(right.exportName),
	);
}

export function parseDrizzleEnums(sourceText: string): DrizzleEnum[] {
	const source = ts.createSourceFile(
		"enums.ts",
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const enums: DrizzleEnum[] = [];

	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
				continue;
			}

			const initializer = unwrapExpression(declaration.initializer);
			if (!ts.isObjectLiteralExpression(initializer)) {
				continue;
			}

			const values = initializer.properties.flatMap((property) => {
				if (
					!ts.isPropertyAssignment(property) ||
					!ts.isStringLiteral(property.initializer)
				) {
					return [];
				}
				return [property.initializer.text];
			});

			if (
				values.length > 0 &&
				values.length === initializer.properties.length
			) {
				enums.push({ name: declaration.name.text, values });
			}
		}
	}

	return enums.sort((left, right) => left.name.localeCompare(right.name));
}

export async function listMigrations(projectRoot: string): Promise<string[]> {
	return listKnownFiles(projectRoot, MIGRATIONS_PATH, new Set([".sql"]));
}

export async function listMigrationMetadata(
	projectRoot: string,
): Promise<string[]> {
	return listKnownFiles(
		projectRoot,
		MIGRATION_METADATA_PATH,
		new Set([".json"]),
	);
}

export async function readDatabaseSchema(projectRoot: string): Promise<string> {
	const sections = await Promise.all(
		SCHEMA_FILES.map(async (path) => {
			const content = await readKnownFile(projectRoot, path, SCHEMA_FILES);
			return `// ${path}\n\n${content}`;
		}),
	);

	return sections.join("\n\n");
}

export async function readMigration(
	projectRoot: string,
	path: string,
): Promise<string> {
	return readKnownFile(projectRoot, path, await listMigrations(projectRoot));
}

export async function readMigrationMetadata(
	projectRoot: string,
	path: string,
): Promise<string> {
	return readKnownFile(
		projectRoot,
		path,
		await listMigrationMetadata(projectRoot),
	);
}

export async function getDatabaseSummary(
	projectRoot: string,
): Promise<DatabaseSummary> {
	const [tablesSource, enumsSource] = await Promise.all([
		readKnownFile(projectRoot, "lib/db/schema/tables.ts", SCHEMA_FILES),
		readKnownFile(projectRoot, "lib/db/schema/enums.ts", SCHEMA_FILES),
	]);

	return {
		orm: "Drizzle",
		schemaFiles: [...SCHEMA_FILES],
		tables: parseDrizzleTables(tablesSource),
		enums: parseDrizzleEnums(enumsSource),
		migrations: await listMigrations(projectRoot),
		migrationMetadata: await listMigrationMetadata(projectRoot),
	};
}

export function getDatabaseWorkflow(workflow: DatabaseWorkflow): {
	workflow: DatabaseWorkflow;
	steps: string[];
	notes: string[];
} {
	const workflows: Record<
		DatabaseWorkflow,
		{ steps: string[]; notes: string[] }
	> = {
		"change-schema": {
			steps: [
				"Edit lib/db/schema/tables.ts, enums.ts and relations.ts as needed.",
				"Run npm run db:generate.",
				"Review the generated SQL migration and metadata before committing them.",
				"Run npm run db:migrate against the local database.",
				"Run npm run typecheck and the relevant tests.",
			],
			notes: [
				"Commit the generated SQL file and matching lib/db/migrations/meta files together.",
				"Preserve organizationId filters and indexes on tenant-owned data.",
			],
		},
		"apply-production": {
			steps: [
				"Deploy code that already contains reviewed migration and metadata files.",
				"Run npm run db:migrate in the deployment environment.",
				"Verify application health before removing compatibility code.",
			],
			notes: [
				"db:migrate applies checked-in migrations; it does not generate them.",
				"Back up production data before destructive or irreversible changes.",
			],
		},
		"inspect-data": {
			steps: [
				"Run npm run db:studio.",
				"Inspect data without changing the schema.",
			],
			notes: [
				"Drizzle Studio uses DATABASE_URL from the active environment.",
				"Do not point local tooling at production unintentionally.",
			],
		},
		prototype: {
			steps: [
				"Edit the files in lib/db/schema.",
				"Use npm run db:push only for disposable local prototyping.",
				"Generate and review a real migration before sharing the change.",
			],
			notes: [
				"db:push bypasses checked-in migration history and is not the release workflow.",
			],
		},
	};

	return { workflow, ...workflows[workflow] };
}
