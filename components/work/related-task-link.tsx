"use client";

import Link from "next/link";
import type * as React from "react";

function isModifiedClick(event: React.MouseEvent): boolean {
	return (
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		event.button !== 0
	);
}

/**
 * Parent / subtask / dependency link. Modified clicks (new tab, etc.) follow
 * the href; a plain click can stay in the current peek or page.
 */
export function RelatedTaskLink({
	taskId,
	onOpenTask,
	className,
	children,
}: {
	taskId: string;
	onOpenTask?: (taskId: string) => void;
	className?: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<Link
			href={`/dashboard/organization/tasks/${taskId}`}
			className={className}
			onClick={(event) => {
				if (!onOpenTask || isModifiedClick(event)) return;
				event.preventDefault();
				onOpenTask(taskId);
			}}
		>
			{children}
		</Link>
	);
}
