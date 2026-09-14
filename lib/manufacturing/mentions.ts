/**
 * @mentions in task comments.
 *
 * A mention is stored inside the comment body as `@[Display Name](user:<id>)`
 * so the body stays a single string (offline queue, notifications and the
 * database need no extra columns) while the id survives renames and duplicate
 * names. The UI shows the token as a highlighted `@Display Name`.
 */

/** One global pattern for scanning; use `mentionPattern()` for a fresh copy. */
const MENTION_SOURCE = String.raw`@\[([^\[\]\n]{1,120})\]\(user:([A-Za-z0-9_-]{1,64})\)`;

export function mentionPattern(): RegExp {
	return new RegExp(MENTION_SOURCE, "g");
}

export type MentionRef = {
	userId: string;
	name: string;
};

export type CommentSegment =
	| { type: "text"; text: string }
	| { type: "mention"; userId: string; name: string };

/** Serialise a mention for storage in a comment body. */
export function formatMention(ref: MentionRef): string {
	const name =
		ref.name
			.replace(/[[\]\n]/g, " ")
			.trim()
			.slice(0, 120) || "?";
	return `@[${name}](user:${ref.userId})`;
}

/** Split a stored comment body into plain text and mention segments. */
export function splitMentions(body: string): CommentSegment[] {
	const segments: CommentSegment[] = [];
	const pattern = mentionPattern();
	let lastIndex = 0;
	let match: RegExpExecArray | null = pattern.exec(body);

	while (match) {
		if (match.index > lastIndex) {
			segments.push({ type: "text", text: body.slice(lastIndex, match.index) });
		}
		segments.push({ type: "mention", name: match[1]!, userId: match[2]! });
		lastIndex = match.index + match[0].length;
		match = pattern.exec(body);
	}

	if (lastIndex < body.length) {
		segments.push({ type: "text", text: body.slice(lastIndex) });
	}

	return segments;
}

/** Unique ids of everybody mentioned in a body, in order of first appearance. */
export function extractMentionedUserIds(body: string): string[] {
	const ids: string[] = [];
	for (const segment of splitMentions(body)) {
		if (segment.type === "mention" && !ids.includes(segment.userId)) {
			ids.push(segment.userId);
		}
	}
	return ids;
}

/** Body with every mention token collapsed to `@Name` (notifications, excerpts). */
export function mentionsToPlainText(body: string): string {
	return splitMentions(body)
		.map((segment) =>
			segment.type === "mention" ? `@${segment.name}` : segment.text,
		)
		.join("");
}

/**
 * Keep only mentions of `allowedUserIds` (the organization's members); any
 * other token is demoted to plain `@Name` text so a stale offline comment
 * still lands instead of being rejected.
 */
export function sanitizeMentions(
	body: string,
	allowedUserIds: ReadonlySet<string>,
): string {
	return splitMentions(body)
		.map((segment) => {
			if (segment.type === "text") return segment.text;
			return allowedUserIds.has(segment.userId)
				? formatMention(segment)
				: `@${segment.name}`;
		})
		.join("");
}

/**
 * Turn what the user typed (`Ask @Anna Müller about it`) into a storable body by
 * replacing the display form of every picked member with its token. Longer
 * names are replaced first so "Anna Müller" is never clipped by "Anna".
 * Members whose `@Name` no longer appears in the text are dropped.
 */
export function encodeMentions(text: string, picked: MentionRef[]): string {
	const unique = new Map<string, MentionRef>();
	for (const ref of picked) {
		if (!unique.has(ref.userId)) unique.set(ref.userId, ref);
	}
	const byLength = [...unique.values()].sort(
		(a, b) => b.name.length - a.name.length,
	);

	let body = text;
	for (const ref of byLength) {
		const display = `@${ref.name}`;
		if (!body.includes(display)) continue;
		const token = formatMention(ref);
		// Replace whole-word occurrences only: "@Anna" must not match "@Annabel".
		const escaped = display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		body = body.replace(
			new RegExp(`${escaped}(?![\\p{L}\\p{N}_])`, "gu"),
			() => token,
		);
	}
	return body;
}

/**
 * Reverse of `encodeMentions` for editing an existing body in the textarea:
 * returns the display text plus the refs needed to re-encode it.
 */
export function decodeMentions(body: string): {
	text: string;
	mentions: MentionRef[];
} {
	const mentions: MentionRef[] = [];
	const text = splitMentions(body)
		.map((segment) => {
			if (segment.type === "text") return segment.text;
			if (!mentions.some((ref) => ref.userId === segment.userId)) {
				mentions.push({ userId: segment.userId, name: segment.name });
			}
			return `@${segment.name}`;
		})
		.join("");
	return { text, mentions };
}

/**
 * Find an `@query` being typed at the caret: returns the query (may be empty)
 * and where the `@` sits, or null when the caret is not inside one. Names of
 * already picked members are passed in so a completed `@Anna Müller ` does not
 * reopen the picker while the user keeps typing behind it.
 */
export function activeMentionQuery(
	text: string,
	caret: number,
	pickedNames: readonly string[] = [],
): { start: number; query: string } | null {
	const before = text.slice(0, caret);
	const at = before.lastIndexOf("@");
	if (at === -1) return null;
	// The @ must start a word (beginning of text or after whitespace/punctuation).
	const prev = at > 0 ? before[at - 1]! : " ";
	if (/[\p{L}\p{N}_@]/u.test(prev)) return null;
	const query = before.slice(at + 1);
	// A mention query is a single line and short; two spaces or sentence
	// punctuation mean the user moved on to the rest of the message.
	if (
		query.includes("\n") ||
		query.length > 60 ||
		/\s{2}$/.test(query) ||
		/[,;:!?]/.test(query)
	) {
		return null;
	}
	const completed = pickedNames.some(
		(name) =>
			query.startsWith(name) &&
			!/[\p{L}\p{N}_]/u.test(query.charAt(name.length)),
	);
	if (completed) return null;
	return { start: at, query };
}
