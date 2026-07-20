"use client";

import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { GradientCard } from "@/components/marketing/primitives/gradient-card";
import { cn } from "@/lib/utils";

function HeroScreenshot() {
	return (
		<div className="flex flex-col gap-32">
			{/* Mobile/Tablet Screenshot - visible below lg */}
			<GradientCard
				color="green"
				placement="bottom-right"
				className="lg:hidden"
				rounded="xl"
			>
				<img
					src="/marketing/placeholders/placeholder-hero-light.webp"
					alt="App screenshot"
					width={1328}
					height={727}
					className="h-auto w-full dark:hidden"
				/>
				<img
					src="/marketing/placeholders/placeholder-hero-dark.webp"
					alt="App screenshot"
					width={1328}
					height={727}
					className="hidden h-auto w-full dark:block"
				/>
			</GradientCard>

			{/* Desktop Screenshot - visible at lg and above */}
			<GradientCard
				color="green"
				placement="bottom"
				className="hidden lg:block"
				rounded="2xl"
			>
				<img
					src="/marketing/placeholders/placeholder-hero-light.webp"
					alt="App screenshot"
					width={1328}
					height={727}
					className="h-auto w-full dark:hidden"
				/>
				<img
					src="/marketing/placeholders/placeholder-hero-dark.webp"
					alt="App screenshot"
					width={1328}
					height={727}
					className="hidden h-auto w-full dark:block"
				/>
			</GradientCard>
		</div>
	);
}

export function HeroSection() {
	return (
		<section id="hero" className="scroll-mt-14 py-16">
			<div className="mx-auto flex max-w-2xl flex-col gap-16 px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
				<div className="flex flex-col gap-32">
					<div className="flex flex-col items-start gap-6">
						{/* Announcement Pill */}
						<Link
							href="#"
							className={cn(
								"relative inline-flex max-w-full items-center gap-3 overflow-hidden rounded-md px-3.5 py-2 text-sm",
								"bg-marketing-card",
								"hover:bg-marketing-card-hover",
								"dark:ring-1 dark:ring-white/5 dark:ring-inset",
								"sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:px-3 sm:py-0.5",
							)}
						>
							<span className="truncate text-pretty sm:truncate">
								Introducing our latest features
							</span>
							<span className="hidden h-3 w-px bg-marketing-card-hover sm:block" />
							<span className="inline-flex shrink-0 items-center gap-1 font-semibold">
								Learn more
								<ChevronRightIcon className="size-3" />
							</span>
						</Link>

						{/* Headline */}
						<h1
							className={cn(
								"tracking-display-tight max-w-5xl font-display text-5xl text-balance",
								"text-marketing-fg",
								"sm:text-5xl sm:leading-14",
								"lg:text-[5rem] lg:leading-20",
							)}
						>
							Production-ready SaaS. Right out of the box.
						</h1>

						{/* Description */}
						<div className="flex max-w-3xl flex-col gap-4 text-lg leading-8 text-marketing-fg-muted">
							<p>
								Demo application built with Achromatic. Next.js 16 starter kit
								with auth, organizations, subscriptions, credits, AI chatbot and
								admin panel - powered by Better Auth and tRPC.
							</p>
						</div>

						{/* CTA Buttons */}
						<div className="flex items-center gap-4">
							<Link
								href="/auth/sign-up"
								className={cn(
									"inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
									"bg-marketing-accent text-marketing-accent-fg hover:bg-marketing-accent-hover",
								)}
							>
								Get Started
							</Link>
							<Link
								href="/contact"
								className={cn(
									"group inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
									"text-marketing-fg hover:bg-marketing-card-hover",
								)}
							>
								Book a Demo
								<ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
							</Link>
						</div>
					</div>

					<HeroScreenshot />
				</div>
			</div>
		</section>
	);
}
