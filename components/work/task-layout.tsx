import { CheckIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** Label-left / value-right row. Parent must be a `dl` grid with two columns. */
export function TaskFieldRow({
	label,
	children,
}: React.PropsWithChildren<{ label: string }>): React.JSX.Element {
	return (
		<>
			<dt className="flex h-8 items-center text-13 text-fg-secondary">
				{label}
			</dt>
			<dd className="flex min-h-8 min-w-0 items-center">{children}</dd>
		</>
	);
}

export function TaskSection({
	title,
	count,
	aside,
	className,
	children,
}: React.PropsWithChildren<{
	title: string;
	count?: string;
	aside?: React.ReactNode;
	className?: string;
}>): React.JSX.Element {
	return (
		<section className={cn("mt-6", className)}>
			<div className="mb-2 flex items-center gap-2">
				<h2 className="text-sm font-semibold">{title}</h2>
				{count && (
					<span className="rounded bg-layer-1 px-1.5 py-px text-xs text-fg-secondary tabular-nums">
						{count}
					</span>
				)}
				{aside && <span className="ml-auto flex items-center">{aside}</span>}
			</div>
			{children}
		</section>
	);
}

/** Asana-style completion circle used for checklist items and subtasks. */
export function TaskCheckCircle({
	done,
	className,
}: {
	done: boolean;
	className?: string;
}): React.JSX.Element {
	return (
		<span
			className={cn(
				"flex size-[18px] shrink-0 items-center justify-center rounded-full border",
				done
					? "border-success bg-success text-white"
					: "border-strong text-transparent hover:border-success hover:text-success",
				className,
			)}
		>
			<CheckIcon className="size-3" strokeWidth={2.5} />
		</span>
	);
}
