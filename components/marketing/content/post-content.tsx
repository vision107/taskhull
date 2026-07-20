"use client";

import { MdxContent } from "./mdx-content";

export function PostContent({ content }: { content: string }) {
	return (
		<MdxContent
			content={content}
			className="dark:prose-invert prose w-full max-w-none"
		/>
	);
}
