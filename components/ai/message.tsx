"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { memo, useCallback, useState } from "react";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
	({ className, ...props }: MessageResponseProps) => (
		<Streamdown
			className={cn(
				"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

MessageResponse.displayName = "MessageResponse";

export type MessageCopyButtonProps = Omit<
	ComponentProps<typeof Button>,
	"onClick"
> & {
	content: string;
};

export function MessageCopyButton({
	content,
	className,
	variant = "ghost",
	size = "icon",
	...props
}: MessageCopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			const textArea = document.createElement("textarea");
			textArea.value = content;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [content]);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						className={cn("size-7", className)}
						onClick={handleCopy}
						size={size}
						type="button"
						variant={variant}
						{...props}
					>
						{copied ? (
							<CheckIcon className="size-3.5" />
						) : (
							<CopyIcon className="size-3.5" />
						)}
						<span className="sr-only">
							{copied ? "Copied" : "Copy message"}
						</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{copied ? "Copied!" : "Copy message"}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
