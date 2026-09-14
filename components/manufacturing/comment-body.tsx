import * as React from "react";

import { splitMentions } from "@/lib/manufacturing/mentions";
import { cn } from "@/lib/utils";

type CommentBodyProps = {
	body: string;
	/** Highlights mentions of the viewer. */
	currentUserId?: string | null;
	className?: string;
};

/**
 * Renders a stored comment body, turning `@[Name](user:id)` tokens into
 * highlighted `@Name` chips.
 */
export function CommentBody({
	body,
	currentUserId,
	className,
}: CommentBodyProps): React.JSX.Element {
	const segments = splitMentions(body);

	return (
		<p className={cn("text-sm whitespace-pre-wrap", className)}>
			{segments.map((segment, index) => {
				if (segment.type === "text") {
					return <React.Fragment key={index}>{segment.text}</React.Fragment>;
				}
				const isMe = currentUserId != null && segment.userId === currentUserId;
				return (
					<span
						key={index}
						data-mention={segment.userId}
						className={cn(
							"rounded px-1 py-px font-medium",
							isMe
								? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
								: "bg-primary/10 text-primary",
						)}
					>
						@{segment.name}
					</span>
				);
			})}
		</p>
	);
}
