"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { GradientCard } from "@/components/marketing/primitives/gradient-card";
import { cn } from "@/lib/utils";

interface Feature {
	title: string;
	description: string;
	link: string;
	linkText: string;
	color: "green" | "blue" | "purple" | "brown";
	placement: "bottom-right" | "bottom-left";
	image: {
		light: string;
		dark: string;
		width: number;
		height: number;
	};
}

function FeatureCard({ feature }: { feature: Feature }) {
	return (
		<div className="overflow-hidden rounded-lg bg-marketing-card p-2">
			{/* Screenshot */}
			<div className="relative overflow-hidden rounded-sm dark:after:absolute dark:after:inset-0 dark:after:rounded-sm dark:after:outline dark:after:outline-1 dark:after:-outline-offset-1 dark:after:outline-white/10 dark:after:content-['']">
				<GradientCard
					color={feature.color}
					placement={feature.placement}
					rounded="sm"
				>
					<img
						src={feature.image.light}
						alt={feature.title}
						width={feature.image.width}
						height={feature.image.height}
						className="dark:hidden w-full h-auto"
					/>
					<img
						src={feature.image.dark}
						alt={feature.title}
						width={feature.image.width}
						height={feature.image.height}
						className="hidden dark:block w-full h-auto"
					/>
				</GradientCard>
			</div>

			{/* Content */}
			<div className="flex flex-col gap-4 p-6 sm:p-10 lg:p-6">
				<div>
					<h3 className="text-base font-medium leading-8 text-marketing-fg">
						{feature.title}
					</h3>
					<div className="mt-2 flex flex-col gap-4 text-sm leading-7 text-marketing-fg-muted">
						<p>{feature.description}</p>
					</div>
				</div>
				<Link
					href={feature.link}
					className="group inline-flex items-center gap-2 text-sm font-medium text-marketing-fg"
				>
					{feature.linkText}
					<ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
				</Link>
			</div>
		</div>
	);
}

export function FeaturesSection() {
	const features: Feature[] = [
		{
			title: "Auth & Organizations",
			description:
				"Secure authentication with Better Auth. Built-in support for multi-tenant organizations, member invitations and granular role-based permissions.",
			link: "#",
			linkText: "Explore Auth",
			color: "blue",
			placement: "bottom-right",
			image: {
				light: "/marketing/placeholders/placeholder-light.webp",
				dark: "/marketing/placeholders/placeholder-dark.webp",
				width: 600,
				height: 400,
			},
		},
		{
			title: "AI & Credits System",
			description:
				"Launch AI-powered features instantly. Includes a complete chatbot UI, OpenAI integration and a flexible credit consumption system.",
			link: "#",
			linkText: "Review Stack",
			color: "purple",
			placement: "bottom-left",
			image: {
				light: "/marketing/placeholders/placeholder-light.webp",
				dark: "/marketing/placeholders/placeholder-dark.webp",
				width: 600,
				height: 400,
			},
		},
	];

	return (
		<section id="features" className="py-16 scroll-mt-14">
			<div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 md:max-w-3xl lg:max-w-7xl lg:gap-16 lg:px-10">
				{/* Header */}
				<div className="flex max-w-2xl flex-col gap-6">
					<div className="flex flex-col gap-2">
						<div className="text-sm font-semibold leading-7 text-marketing-fg-muted">
							Powerful Features
						</div>
						<h2
							className={cn(
								"text-pretty font-display text-[2rem] leading-10 tracking-tight",
								"text-marketing-fg",
								"sm:text-5xl sm:leading-14",
							)}
						>
							The complete SaaS foundation
						</h2>
					</div>
					<div className="text-base leading-7 text-marketing-fg-muted text-pretty">
						<p>
							Everything you need to build a production-ready application. From
							authentication to payments, it's all included.
						</p>
					</div>
				</div>

				{/* Features Grid */}
				<div>
					<div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
						{features.map((feature) => (
							<FeatureCard key={feature.title} feature={feature} />
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
