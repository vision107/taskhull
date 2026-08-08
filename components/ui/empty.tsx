import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn("flex max-w-sm flex-col items-center gap-2", className)}
			{...props}
		/>
	);
}

export const emptyMediaVariants = cva(
	"mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function EmptyMedia({
	className,
	variant = "default",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			className={cn(emptyMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-title"
			className={cn("text-sm font-medium tracking-tight", className)}
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<div
			data-slot="empty-description"
			className={cn(
				"text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cn(
				"flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance",
				className,
			)}
			{...props}
		/>
	);
}

export type EmptyElement = import("react").ComponentRef<typeof Empty>;
export type EmptyProps = import("react").ComponentProps<typeof Empty>;
export type EmptyHeaderElement = import("react").ComponentRef<
	typeof EmptyHeader
>;
export type EmptyHeaderProps = import("react").ComponentProps<
	typeof EmptyHeader
>;
export type EmptyMediaElement = import("react").ComponentRef<typeof EmptyMedia>;
export type EmptyMediaProps = import("react").ComponentProps<typeof EmptyMedia>;
export type EmptyTitleElement = import("react").ComponentRef<typeof EmptyTitle>;
export type EmptyTitleProps = import("react").ComponentProps<typeof EmptyTitle>;
export type EmptyDescriptionElement = import("react").ComponentRef<
	typeof EmptyDescription
>;
export type EmptyDescriptionProps = import("react").ComponentProps<
	typeof EmptyDescription
>;
export type EmptyContentElement = import("react").ComponentRef<
	typeof EmptyContent
>;
export type EmptyContentProps = import("react").ComponentProps<
	typeof EmptyContent
>;

export {
	Empty,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
	EmptyContent,
	EmptyMedia,
};
