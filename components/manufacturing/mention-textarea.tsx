"use client";

import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import {
	activeMentionQuery,
	encodeMentions,
	type MentionRef,
} from "@/lib/manufacturing/mentions";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type MentionCandidate = {
	id: string;
	name: string;
	email?: string | null;
	image?: string | null;
};

export type MentionDraft = {
	/** What the user sees in the textarea: `Ask @Anna Müller`. */
	text: string;
	/** Members picked from the popover; encoded into the body on submit. */
	mentions: MentionRef[];
};

const EMPTY_DRAFT: MentionDraft = { text: "", mentions: [] };

/**
 * State for a comment box with @mentions. `body` is what gets sent to the
 * server (`@[Anna Müller](user:…)`), `draft.text` is what is shown.
 */
export function useMentionDraft(initial: MentionDraft = EMPTY_DRAFT) {
	const [draft, setDraft] = React.useState<MentionDraft>(initial);

	const setText = React.useCallback((text: string) => {
		setDraft((current) => ({ ...current, text }));
	}, []);

	const addMention = React.useCallback((ref: MentionRef) => {
		setDraft((current) =>
			current.mentions.some((item) => item.userId === ref.userId)
				? current
				: { ...current, mentions: [...current.mentions, ref] },
		);
	}, []);

	const reset = React.useCallback(() => setDraft(EMPTY_DRAFT), []);

	const body = React.useMemo(
		() => encodeMentions(draft.text, draft.mentions).trim(),
		[draft],
	);

	return { draft, setDraft, setText, addMention, reset, body };
}

export type MentionTextareaProps = Omit<
	React.ComponentProps<typeof Textarea>,
	"value" | "onChange"
> & {
	draft: MentionDraft;
	onDraftChange: (draft: MentionDraft) => void;
	/** Left out of the suggestions (usually the current user). */
	excludeUserId?: string | null;
	labels?: {
		noMatches: string;
		loading: string;
	};
	/** Where the suggestion list opens relative to the textarea. */
	side?: "top" | "bottom";
	/** Classes for the positioning wrapper (defaults to a flex-1 column). */
	containerClassName?: string;
};

const MAX_SUGGESTIONS = 6;

function matches(candidate: MentionCandidate, query: string): boolean {
	if (!query) return true;
	const needle = query.toLocaleLowerCase();
	return (
		candidate.name.toLocaleLowerCase().includes(needle) ||
		(candidate.email?.toLocaleLowerCase().includes(needle) ?? false)
	);
}

/**
 * Textarea that pops up the organization's members while typing `@…`.
 * Selecting a member inserts `@Name ` into the text and remembers the member
 * so `encodeMentions` can turn it into a token when the comment is sent.
 */
export function MentionTextarea({
	draft,
	onDraftChange,
	excludeUserId,
	labels = { noMatches: "No teammates found", loading: "Loading…" },
	side = "top",
	containerClassName,
	className,
	onKeyDown,
	onBlur,
	onFocus,
	ref,
	...props
}: MentionTextareaProps): React.JSX.Element {
	const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
	const [focused, setFocused] = React.useState(false);
	const [caret, setCaret] = React.useState(0);
	const [dismissedAt, setDismissedAt] = React.useState<number | null>(null);
	const [highlighted, setHighlighted] = React.useState(0);
	const [pendingCaret, setPendingCaret] = React.useState<number | null>(null);
	const listId = React.useId();

	const { data: members, isLoading } =
		trpc.organization.build.assignees.useQuery(undefined, {
			enabled: focused,
			staleTime: 5 * 60_000,
		});

	const pickedNames = React.useMemo(
		() => draft.mentions.map((ref) => ref.name),
		[draft.mentions],
	);
	const active = focused
		? activeMentionQuery(draft.text, caret, pickedNames)
		: null;
	const isOpen = active !== null && dismissedAt !== active.start;

	const suggestions = React.useMemo(() => {
		if (!isOpen || !members) return [];
		const query = active?.query ?? "";
		return members
			.filter((member) => member.id !== excludeUserId && matches(member, query))
			.slice(0, MAX_SUGGESTIONS);
	}, [isOpen, members, active?.query, excludeUserId]);

	// Keep the highlight inside the list as suggestions change.
	React.useEffect(() => {
		setHighlighted(0);
	}, [active?.query, active?.start]);

	// Place the caret after an inserted mention once React has flushed the text.
	React.useEffect(() => {
		if (pendingCaret === null) return;
		const element = innerRef.current;
		if (element) {
			element.setSelectionRange(pendingCaret, pendingCaret);
			element.focus();
		}
		setCaret(pendingCaret);
		setPendingCaret(null);
	}, [pendingCaret]);

	const setRefs = (element: HTMLTextAreaElement | null) => {
		innerRef.current = element;
		if (typeof ref === "function") {
			ref(element);
		} else if (ref) {
			ref.current = element;
		}
	};

	const syncCaret = () => {
		const element = innerRef.current;
		if (element) setCaret(element.selectionStart ?? element.value.length);
	};

	const pick = (member: MentionCandidate) => {
		if (!active) return;
		const insert = `@${member.name} `;
		const nextText =
			draft.text.slice(0, active.start) + insert + draft.text.slice(caret);
		const nextMentions = draft.mentions.some(
			(item) => item.userId === member.id,
		)
			? draft.mentions
			: [...draft.mentions, { userId: member.id, name: member.name }];
		onDraftChange({ text: nextText, mentions: nextMentions });
		setPendingCaret(active.start + insert.length);
		setDismissedAt(null);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (isOpen && suggestions.length > 0) {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setHighlighted((index) => (index + 1) % suggestions.length);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setHighlighted(
					(index) => (index - 1 + suggestions.length) % suggestions.length,
				);
				return;
			}
			if (
				(event.key === "Enter" && !event.metaKey && !event.ctrlKey) ||
				event.key === "Tab"
			) {
				event.preventDefault();
				const member = suggestions[highlighted] ?? suggestions[0];
				if (member) pick(member);
				return;
			}
		}
		if (isOpen && event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			setDismissedAt(active?.start ?? null);
			return;
		}
		onKeyDown?.(event);
	};

	const highlightedId = suggestions[highlighted]?.id;

	return (
		<div className={cn("relative min-w-0 flex-1", containerClassName)}>
			<Textarea
				{...props}
				ref={setRefs}
				value={draft.text}
				className={cn("w-full", className)}
				aria-controls={isOpen ? listId : undefined}
				aria-activedescendant={
					isOpen && highlightedId ? `${listId}-${highlightedId}` : undefined
				}
				aria-autocomplete="list"
				onChange={(event) => {
					onDraftChange({ ...draft, text: event.target.value });
					setCaret(event.target.selectionStart ?? event.target.value.length);
					setDismissedAt(null);
				}}
				onKeyDown={handleKeyDown}
				onKeyUp={syncCaret}
				onClick={syncCaret}
				onSelect={syncCaret}
				onFocus={(event) => {
					setFocused(true);
					syncCaret();
					onFocus?.(event);
				}}
				onBlur={(event) => {
					setFocused(false);
					onBlur?.(event);
				}}
			/>
			{isOpen && (
				<div
					id={listId}
					role="listbox"
					aria-label="Mention a teammate"
					className={cn(
						"absolute left-0 z-50 flex max-h-64 w-72 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md",
						side === "top" ? "bottom-full mb-1" : "top-full mt-1",
					)}
				>
					{suggestions.length === 0 ? (
						<p className="px-2 py-1.5 text-muted-foreground">
							{isLoading ? labels.loading : labels.noMatches}
						</p>
					) : (
						suggestions.map((member, index) => (
							<button
								key={member.id}
								type="button"
								tabIndex={-1}
								id={`${listId}-${member.id}`}
								role="option"
								aria-selected={index === highlighted}
								className={cn(
									"flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left",
									index === highlighted && "bg-accent text-accent-foreground",
								)}
								// Keep focus (and the caret) in the textarea while picking.
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setHighlighted(index)}
								onClick={() => pick(member)}
							>
								<UserAvatar
									name={member.name}
									src={member.image}
									className="size-6"
									fallbackClassName="text-[10px]"
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate">{member.name}</p>
									{member.email ? (
										<p className="truncate text-xs text-muted-foreground">
											{member.email}
										</p>
									) : null}
								</div>
							</button>
						))
					)}
				</div>
			)}
		</div>
	);
}
