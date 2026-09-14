import { describe, expect, it } from "vitest";

import {
	activeMentionQuery,
	decodeMentions,
	encodeMentions,
	extractMentionedUserIds,
	formatMention,
	mentionsToPlainText,
	sanitizeMentions,
	splitMentions,
} from "@/lib/manufacturing/mentions";

const anna = { userId: "user_anna", name: "Anna Müller" };
const annabel = { userId: "user_annabel", name: "Anna" };
const bob = { userId: "b2222222-2222-4222-8222-222222222222", name: "Bob" };

describe("mentions", () => {
	it("formats a token and strips characters that would break it", () => {
		expect(formatMention(anna)).toBe("@[Anna Müller](user:user_anna)");
		expect(formatMention({ userId: "x", name: "We[ird]\nName" })).toBe(
			"@[We ird  Name](user:x)",
		);
	});

	it("splits a body into text and mention segments", () => {
		const body = `Hi ${formatMention(anna)}, ${formatMention(bob)} knows.`;
		expect(splitMentions(body)).toEqual([
			{ type: "text", text: "Hi " },
			{ type: "mention", name: "Anna Müller", userId: "user_anna" },
			{ type: "text", text: ", " },
			{ type: "mention", name: "Bob", userId: bob.userId },
			{ type: "text", text: " knows." },
		]);
		expect(splitMentions("no mentions here")).toEqual([
			{ type: "text", text: "no mentions here" },
		]);
		expect(splitMentions("")).toEqual([]);
	});

	it("ignores malformed tokens", () => {
		expect(splitMentions("@[Anna](user:)")).toEqual([
			{ type: "text", text: "@[Anna](user:)" },
		]);
		expect(splitMentions("@[Anna](file:abc) @Bob")).toEqual([
			{ type: "text", text: "@[Anna](file:abc) @Bob" },
		]);
	});

	it("extracts unique user ids in order of appearance", () => {
		const body = `${formatMention(bob)} ${formatMention(anna)} ${formatMention(bob)}`;
		expect(extractMentionedUserIds(body)).toEqual([bob.userId, anna.userId]);
	});

	it("demotes mentions of non-members to plain text", () => {
		const body = `${formatMention(anna)} and ${formatMention(bob)}`;
		expect(sanitizeMentions(body, new Set([bob.userId]))).toBe(
			`@Anna Müller and ${formatMention(bob)}`,
		);
	});

	it("renders plain text for notifications", () => {
		expect(mentionsToPlainText(`Ask ${formatMention(anna)} first`)).toBe(
			"Ask @Anna Müller first",
		);
	});

	it("encodes picked members, longest name first and whole word only", () => {
		const text = "@Anna Müller and @Anna, but not @Annabel";
		expect(encodeMentions(text, [annabel, anna])).toBe(
			`${formatMention(anna)} and ${formatMention(annabel)}, but not @Annabel`,
		);
	});

	it("drops picked members that were deleted from the text again", () => {
		expect(encodeMentions("plain text", [anna])).toBe("plain text");
	});

	it("round-trips through decode", () => {
		const body = `Ping ${formatMention(anna)} & ${formatMention(bob)}`;
		const decoded = decodeMentions(body);
		expect(decoded.text).toBe("Ping @Anna Müller & @Bob");
		expect(decoded.mentions).toEqual([anna, bob]);
		expect(encodeMentions(decoded.text, decoded.mentions)).toBe(body);
	});

	describe("activeMentionQuery", () => {
		it("detects an @ at the caret", () => {
			expect(activeMentionQuery("hello @", 7)).toEqual({ start: 6, query: "" });
			expect(activeMentionQuery("hello @an", 9)).toEqual({
				start: 6,
				query: "an",
			});
			expect(activeMentionQuery("@anna mü", 8)).toEqual({
				start: 0,
				query: "anna mü",
			});
		});

		it("ignores e-mail addresses and text after the caret", () => {
			expect(activeMentionQuery("mail me@example.com", 19)).toBeNull();
			expect(activeMentionQuery("@anna later", 0)).toBeNull();
		});

		it("gives up after a line break, two spaces or sentence punctuation", () => {
			expect(activeMentionQuery("@anna\nnext", 10)).toBeNull();
			expect(activeMentionQuery("@anna  ", 7)).toBeNull();
			expect(activeMentionQuery("@anna, can you", 14)).toBeNull();
			expect(activeMentionQuery("@anna? hello", 12)).toBeNull();
		});

		it("does not reopen for a completed mention", () => {
			const text = "@Anna Müller can you";
			expect(activeMentionQuery(text, text.length, ["Anna Müller"])).toBeNull();
			expect(activeMentionQuery(text, text.length)).toEqual({
				start: 0,
				query: "Anna Müller can you",
			});
			// Picked name directly followed by punctuation (user deleted the space).
			expect(
				activeMentionQuery("@Anna Müller.", 13, ["Anna Müller"]),
			).toBeNull();
			// "@Anna" picked must not swallow a new "@Annabel" query.
			expect(activeMentionQuery("@Annabel", 8, ["Anna"])).toEqual({
				start: 0,
				query: "Annabel",
			});
		});
	});
});
