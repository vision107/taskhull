import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn("animate-pulse rounded-md bg-muted", className)}
			{...props}
		/>
	);
}

export type SkeletonElement = import("react").ComponentRef<typeof Skeleton>;
export type SkeletonProps = import("react").ComponentProps<typeof Skeleton>;

export { Skeleton };
