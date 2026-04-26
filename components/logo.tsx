import type * as React from "react";
import { appConfig } from "@/config/app.config";
import { cn } from "@/lib/utils";

export type LogoProps = {
	className?: string;
	withLabel?: boolean;
};

export function Logo({
	withLabel = true,
	className,
}: LogoProps): React.JSX.Element {
	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<img
				src="/favicon.svg"
				alt=""
				width={36}
				height={32}
				className="h-8 w-auto shrink-0"
				aria-hidden="true"
			/>
			{withLabel && (
				<span className="ml-2 hidden font-bold text-lg md:block">
					{appConfig.appName}
				</span>
			)}
		</span>
	);
}
