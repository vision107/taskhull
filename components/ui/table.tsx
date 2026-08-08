"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div
			data-slot="table-container"
			className="relative w-full overflow-x-auto"
		>
			<table
				data-slot="table"
				className={cn("w-full caption-bottom text-sm", className)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			data-slot="table-header"
			className={cn("[&_tr]:border-b", className)}
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot="table-body"
			className={cn("[&_tr:last-child]:border-0", className)}
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn(
				"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
				className,
			)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				"border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
				className,
			)}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
				className,
			)}
			{...props}
		/>
	);
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<"caption">) {
	return (
		<caption
			data-slot="table-caption"
			className={cn("mt-4 text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export type TableElement = import("react").ComponentRef<typeof Table>;
export type TableProps = import("react").ComponentProps<typeof Table>;
export type TableHeaderElement = import("react").ComponentRef<
	typeof TableHeader
>;
export type TableHeaderProps = import("react").ComponentProps<
	typeof TableHeader
>;
export type TableBodyElement = import("react").ComponentRef<typeof TableBody>;
export type TableBodyProps = import("react").ComponentProps<typeof TableBody>;
export type TableFooterElement = import("react").ComponentRef<
	typeof TableFooter
>;
export type TableFooterProps = import("react").ComponentProps<
	typeof TableFooter
>;
export type TableRowElement = import("react").ComponentRef<typeof TableRow>;
export type TableRowProps = import("react").ComponentProps<typeof TableRow>;
export type TableHeadElement = import("react").ComponentRef<typeof TableHead>;
export type TableHeadProps = import("react").ComponentProps<typeof TableHead>;
export type TableCellElement = import("react").ComponentRef<typeof TableCell>;
export type TableCellProps = import("react").ComponentProps<typeof TableCell>;
export type TableCaptionElement = import("react").ComponentRef<
	typeof TableCaption
>;
export type TableCaptionProps = import("react").ComponentProps<
	typeof TableCaption
>;

export {
	Table,
	TableHeader,
	TableBody,
	TableFooter,
	TableHead,
	TableRow,
	TableCell,
	TableCaption,
};
