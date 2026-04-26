"use client";

import { InfiniteSlider } from "@/components/marketing/primitives/infinite-slider";
import { ProgressiveBlur } from "@/components/marketing/primitives/progressive-blur";

const logos = [
	{
		src: "/marketing/logos/nvidia.svg",
		alt: "Nvidia Logo",
		height: "h-5",
	},
	{
		src: "/marketing/logos/column.svg",
		alt: "Column Logo",
		height: "h-4",
	},
	{
		src: "/marketing/logos/github.svg",
		alt: "GitHub Logo",
		height: "h-4",
	},
	{
		src: "/marketing/logos/nike.svg",
		alt: "Nike Logo",
		height: "h-5",
	},
	{
		src: "/marketing/logos/lemonsqueezy.svg",
		alt: "Lemon Squeezy Logo",
		height: "h-5",
	},
	{
		src: "/marketing/logos/laravel.svg",
		alt: "Laravel Logo",
		height: "h-4",
	},
	{
		src: "/marketing/logos/lilly.svg",
		alt: "Lilly Logo",
		height: "h-7",
	},
	{
		src: "/marketing/logos/openai.svg",
		alt: "OpenAI Logo",
		height: "h-6",
	},
];

export function LogoCloudSection() {
	return (
		<section className="overflow-hidden border-border/50 border-t">
			<div className="group relative mx-auto max-w-screen-2xl px-4 sm:px-6 md:px-12">
				<div className="relative w-full py-6">
					<InfiniteSlider speedOnHover={20} speed={40} gap={112}>
						{logos.map((logo) => (
							<div key={logo.alt} className="flex">
								<img
									className={`mx-auto ${logo.height} w-fit dark:invert`}
									src={logo.src}
									alt={logo.alt}
									width={100}
									height={20}
								/>
							</div>
						))}
					</InfiniteSlider>

					<ProgressiveBlur
						className="pointer-events-none absolute inset-y-0 left-0 h-full w-20"
						direction="left"
						blurIntensity={1}
					/>
					<ProgressiveBlur
						className="pointer-events-none absolute inset-y-0 right-0 h-full w-20"
						direction="right"
						blurIntensity={1}
					/>
				</div>
			</div>
		</section>
	);
}
