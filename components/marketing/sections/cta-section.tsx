"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CtaContent {
	headline: string;
	description: string;
	primaryCta: {
		text: string;
		href: string;
	};
	secondaryCta: {
		text: string;
		href: string;
	};
}

interface CtaSectionProps {
	centered?: boolean;
	content: CtaContent;
}

export function CtaSection({ centered = false, content }: CtaSectionProps) {
	const { headline, description, primaryCta, secondaryCta } = content;

	return (
		<section id="cta" className="py-16">
			<div
				className={cn(
					"mx-auto flex max-w-2xl flex-col gap-10 px-6 md:max-w-3xl lg:max-w-7xl lg:px-10",
					centered && "items-center text-center",
				)}
			>
				{/* Content */}
				<div className="flex flex-col gap-6">
					<div
						className={cn(
							"flex max-w-4xl flex-col gap-2",
							centered && "items-center",
						)}
					>
						<h2
							className={cn(
								"text-pretty font-display text-[2rem] leading-10 tracking-tight",
								"text-marketing-fg",
								"sm:text-5xl sm:leading-14",
							)}
						>
							{headline}
						</h2>
					</div>
					<div className="max-w-3xl text-base leading-7 text-marketing-fg-muted text-pretty">
						<p>{description}</p>
					</div>
				</div>

				{/* Buttons */}
				<div
					className={cn(
						"flex items-center gap-4",
						centered && "justify-center",
					)}
				>
					<Link
						href={primaryCta.href}
						className={cn(
							"inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
							"bg-marketing-accent text-marketing-accent-fg hover:bg-marketing-accent-hover",
						)}
					>
						{primaryCta.text}
					</Link>
					<Link
						href={secondaryCta.href}
						className={cn(
							"group inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
							"text-marketing-fg hover:bg-marketing-card-hover",
						)}
					>
						{secondaryCta.text}
						<ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
					</Link>
				</div>
			</div>
		</section>
	);
}
