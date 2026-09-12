import { db } from "@/lib/db/client";
import type { RevisionAction, RevisionEntity } from "@/lib/db/schema/enums";
import { revisionTable } from "@/lib/db/schema/manufacturing-tables";
import { logger } from "@/lib/logger";

type Row = Record<string, unknown> | null | undefined;

// Columns that should never count as a meaningful change.
const IGNORED_FIELDS = new Set(["updatedAt", "createdAt"]);

/**
 * Deep-convert a value to a JSON-safe shape (Dates -> ISO strings) so it can be
 * stored in a jsonb column and compared deterministically.
 */
function toJsonSafe(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(toJsonSafe);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = toJsonSafe(v);
		}
		return out;
	}
	return value;
}

export function computeChangedFields(
	before: Record<string, unknown>,
	after: Record<string, unknown>,
): string[] {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	const changed: string[] = [];
	for (const key of keys) {
		if (IGNORED_FIELDS.has(key)) continue;
		if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
			changed.push(key);
		}
	}
	return changed;
}

export interface RecordRevisionParams {
	organizationId: string;
	entityType: RevisionEntity;
	entityId: string;
	action: RevisionAction;
	changedById?: string | null;
	/** Row state before the change (omit/null for create). */
	before?: Row;
	/** Row state after the change (omit/null for delete). */
	after?: Row;
	summary?: string | null;
}

/**
 * Record a single revision row capturing the before/after JSON snapshots of a
 * tenant-owned entity. Call from tRPC mutations alongside the write so that
 * template and build changes are traceable.
 *
 * Best-effort: failures are logged and swallowed so audit capture never breaks
 * the primary mutation.
 */
export async function recordRevision(
	params: RecordRevisionParams,
): Promise<void> {
	const before = params.before
		? (toJsonSafe(params.before) as Record<string, unknown>)
		: null;
	const after = params.after
		? (toJsonSafe(params.after) as Record<string, unknown>)
		: null;

	const changedFields =
		before && after ? computeChangedFields(before, after) : null;

	// For updates with no meaningful field change, skip writing noise.
	if (
		params.action === "update" &&
		changedFields &&
		changedFields.length === 0
	) {
		return;
	}

	try {
		await db.insert(revisionTable).values({
			organizationId: params.organizationId,
			entityType: params.entityType,
			entityId: params.entityId,
			action: params.action,
			changedById: params.changedById ?? null,
			snapshot: after,
			previousSnapshot: before,
			changedFields,
			summary: params.summary ?? null,
		});
	} catch (error) {
		logger.warn(
			{ error, entityType: params.entityType, entityId: params.entityId },
			"Failed to record revision",
		);
	}
}
