"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export type QuickAddTaskProps = {
	/** Creates the task; resolve to keep the input open for the next one. */
	onAdd: (title: string) => Promise<unknown>;
	placeholder?: string;
	className?: string;
	/** Extra hint to the right of the input, e.g. the phase it lands in. */
	hint?: string | null;
	/** Focus the input when it appears (e.g. after "Add subtask"). */
	focusOnMount?: boolean;
};

/**
 * One-line "type a title, press Enter" task entry. Everything else (phase,
 * duration, instructions, dependencies) is added later through Edit.
 * Focus stays in the input after each add so a plan can be typed in one go.
 */
export function QuickAddTask({
	onAdd,
	placeholder = "Add a task and press Enter",
	className,
	hint,
	focusOnMount = false,
}: QuickAddTaskProps): React.JSX.Element {
	const [value, setValue] = React.useState("");
	const [pending, setPending] = React.useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (focusOnMount) inputRef.current?.focus();
	}, [focusOnMount]);

	const submit = async () => {
		const title = value.trim();
		if (!title || pending) return;
		setPending(true);
		try {
			await onAdd(title);
			setValue("");
		} catch {
			// The caller surfaces the error (toast); keep the text for a retry.
		} finally {
			setPending(false);
			// Re-focus after React re-enables the input.
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	};

	return (
		<div
			className={cn(
				"flex items-center gap-2 px-4 py-1.5 text-sm",
				"focus-within:bg-muted/30",
				className,
			)}
		>
			{pending ? (
				<Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
			) : (
				<PlusIcon className="size-4 shrink-0 text-muted-foreground" />
			)}
			<input
				ref={inputRef}
				type="text"
				value={value}
				disabled={pending}
				maxLength={200}
				autoComplete="off"
				aria-label={placeholder}
				placeholder={placeholder}
				// 16px on phones: iOS Safari zooms into inputs with smaller text.
				className="h-8 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:opacity-60 md:text-sm"
				onChange={(event) => setValue(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void submit();
					} else if (event.key === "Escape") {
						setValue("");
						inputRef.current?.blur();
					}
				}}
			/>
			{hint && value.length > 0 && (
				<span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
			)}
		</div>
	);
}
