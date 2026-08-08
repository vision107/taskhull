"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as React from "react";

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
	return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
	asChild = false,
	children,
	render,
	...props
}: CollapsiblePrimitive.Trigger.Props & { asChild?: boolean }) {
	return (
		<CollapsiblePrimitive.Trigger
			data-slot="collapsible-trigger"
			render={asChild && React.isValidElement(children) ? children : render}
			{...props}
		>
			{asChild ? undefined : children}
		</CollapsiblePrimitive.Trigger>
	);
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
	return (
		<CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
	);
}

export type CollapsibleElement = import("react").ComponentRef<
	typeof Collapsible
>;
export type CollapsibleProps = import("react").ComponentProps<
	typeof Collapsible
>;
export type CollapsibleTriggerElement = import("react").ComponentRef<
	typeof CollapsibleTrigger
>;
export type CollapsibleTriggerProps = import("react").ComponentProps<
	typeof CollapsibleTrigger
>;
export type CollapsibleContentElement = import("react").ComponentRef<
	typeof CollapsibleContent
>;
export type CollapsibleContentProps = import("react").ComponentProps<
	typeof CollapsibleContent
>;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
