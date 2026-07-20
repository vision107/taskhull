"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export type SheetElement = React.ComponentRef<typeof SheetPrimitive.Root>;
export type SheetProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Root
>;

function Sheet(props: SheetProps): React.JSX.Element {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

export type SheetTriggerElement = React.ComponentRef<
	typeof SheetPrimitive.Trigger
>;
export type SheetTriggerProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Trigger
>;

function SheetTrigger(props: SheetTriggerProps): React.JSX.Element {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

export type SheetCloseElement = React.ComponentRef<typeof SheetPrimitive.Close>;
export type SheetCloseProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Close
>;

function SheetClose(props: SheetCloseProps): React.JSX.Element {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

export type SheetPortalElement = React.ComponentRef<
	typeof SheetPrimitive.Portal
>;
export type SheetPortalProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Portal
>;

function SheetPortal(props: SheetPortalProps): React.JSX.Element {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

export type SheetOverlayElement = React.ComponentRef<
	typeof SheetPrimitive.Overlay
>;
export type SheetOverlayProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Overlay
>;

function SheetOverlay({
	className,
	...props
}: SheetOverlayProps): React.JSX.Element {
	return (
		<SheetPrimitive.Overlay
			data-slot="sheet-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-black/50 fill-mode-forwards! data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
				className,
			)}
			{...props}
		/>
	);
}

export type SheetContentElement = React.ComponentRef<
	typeof SheetPrimitive.Content
>;
export type SheetContentProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Content
> & {
	side?: "top" | "right" | "bottom" | "left";
};

function SheetContent({
	className,
	children,
	side = "right",
	...props
}: SheetContentProps): React.JSX.Element {
	return (
		<SheetPortal>
			<SheetOverlay />
			<SheetPrimitive.Content
				data-slot="sheet-content"
				className={cn(
					"fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out fill-mode-forwards! data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
					side === "right" &&
						"inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
					side === "left" &&
						"inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
					side === "top" &&
						"inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
					side === "bottom" &&
						"inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
					className,
				)}
				{...props}
			>
				{children}
				<SheetPrimitive.Close className="absolute top-5 right-5 cursor-pointer rounded-xs p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
					<XIcon className="size-4" />
					<span className="sr-only">Close</span>
				</SheetPrimitive.Close>
			</SheetPrimitive.Content>
		</SheetPortal>
	);
}

export type SheetHeaderElement = React.ComponentRef<"div">;
export type SheetHeaderProps = React.ComponentPropsWithoutRef<"div">;

function SheetHeader({
	className,
	...props
}: SheetHeaderProps): React.JSX.Element {
	return (
		<div
			data-slot="sheet-header"
			className={cn("flex flex-col gap-1.5 border-b p-6", className)}
			{...props}
		/>
	);
}

export type SheetFooterElement = React.ComponentRef<"div">;
export type SheetFooterProps = React.ComponentPropsWithoutRef<"div">;

function SheetFooter({
	className,
	...props
}: SheetFooterProps): React.JSX.Element {
	return (
		<div
			data-slot="sheet-footer"
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	);
}

export type SheetTitleElement = React.ComponentRef<typeof SheetPrimitive.Title>;
export type SheetTitleProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Title
>;

function SheetTitle({
	className,
	...props
}: SheetTitleProps): React.JSX.Element {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn("font-semibold text-foreground", className)}
			{...props}
		/>
	);
}

export type SheetDescriptionElement = React.ComponentRef<
	typeof SheetPrimitive.Description
>;
export type SheetDescriptionProps = React.ComponentPropsWithoutRef<
	typeof SheetPrimitive.Description
>;

function SheetDescription({
	className,
	...props
}: SheetDescriptionProps): React.JSX.Element {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
};
