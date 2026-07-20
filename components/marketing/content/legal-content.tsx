"use client";

import { MdxContent } from "./mdx-content";

export function LegalContent({ content }: { content: string }) {
	return (
		<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:px-10">
			<MdxContent
				content={content}
				className="dark:prose-invert prose max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h1:hidden prose-h2:text-2xl prose-h2:text-marketing-fg prose-h3:text-xl prose-h3:text-marketing-fg prose-p:text-marketing-fg-muted prose-a:text-marketing-fg prose-strong:text-marketing-fg prose-li:text-marketing-fg-muted"
			/>
		</div>
	);
}
