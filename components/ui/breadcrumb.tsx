import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
	return (
		<nav
			aria-label="breadcrumb"
			data-slot="breadcrumb"
			className={cn(className)}
			{...props}
		/>
	);
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			data-slot="breadcrumb-list"
			className={cn(
				"flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-item"
			className={cn("inline-flex items-center gap-1", className)}
			{...props}
		/>
	);
}

function BreadcrumbLink({
	className,
	asChild = false,
	children,
	render,
	...props
}: useRender.ComponentProps<"a"> & { asChild?: boolean }) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn("transition-colors hover:text-foreground", className),
				children: asChild ? undefined : children,
			},
			props,
		),
		render: asChild && React.isValidElement(children) ? children : render,
		state: {
			slot: "breadcrumb-link",
		},
	});
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-page"
			role="link"
			aria-disabled="true"
			aria-current="page"
			className={cn("font-normal text-foreground", className)}
			{...props}
		/>
	);
}

function BreadcrumbSeparator({
	children,
	className,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-separator"
			role="presentation"
			aria-hidden="true"
			className={cn("[&>svg]:size-3.5", className)}
			{...props}
		>
			{children ?? <ChevronRightIcon />}
		</li>
	);
}

function BreadcrumbEllipsis({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-ellipsis"
			role="presentation"
			aria-hidden="true"
			className={cn(
				"flex size-5 items-center justify-center [&>svg]:size-4",
				className,
			)}
			{...props}
		>
			<MoreHorizontalIcon />
			<span className="sr-only">More</span>
		</span>
	);
}

export type BreadcrumbElement = import("react").ComponentRef<typeof Breadcrumb>;
export type BreadcrumbProps = import("react").ComponentProps<typeof Breadcrumb>;
export type BreadcrumbListElement = import("react").ComponentRef<
	typeof BreadcrumbList
>;
export type BreadcrumbListProps = import("react").ComponentProps<
	typeof BreadcrumbList
>;
export type BreadcrumbItemElement = import("react").ComponentRef<
	typeof BreadcrumbItem
>;
export type BreadcrumbItemProps = import("react").ComponentProps<
	typeof BreadcrumbItem
>;
export type BreadcrumbLinkElement = import("react").ComponentRef<
	typeof BreadcrumbLink
>;
export type BreadcrumbLinkProps = import("react").ComponentProps<
	typeof BreadcrumbLink
>;
export type BreadcrumbPageElement = import("react").ComponentRef<
	typeof BreadcrumbPage
>;
export type BreadcrumbPageProps = import("react").ComponentProps<
	typeof BreadcrumbPage
>;
export type BreadcrumbSeparatorElement = import("react").ComponentRef<
	typeof BreadcrumbSeparator
>;
export type BreadcrumbSeparatorProps = import("react").ComponentProps<
	typeof BreadcrumbSeparator
>;
export type BreadcrumbEllipsisElement = import("react").ComponentRef<
	typeof BreadcrumbEllipsis
>;
export type BreadcrumbEllipsisProps = import("react").ComponentProps<
	typeof BreadcrumbEllipsis
>;

export {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
	BreadcrumbEllipsis,
};
