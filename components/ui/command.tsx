"use client";

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete";
import { CheckIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type ItemRegistry = Map<string, boolean>;

type CommandContextValue = {
	query: string;
	selectedValue: string | undefined;
	registerItem: (id: string, visible: boolean) => () => void;
	selectItem: (value: string) => void;
	visibleItemCount: number;
	registrationSettled: boolean;
};

type CommandGroupContextValue = {
	registerItem: (id: string, visible: boolean) => () => void;
};

const CommandContext = React.createContext<CommandContextValue | null>(null);
const CommandGroupContext =
	React.createContext<CommandGroupContextValue | null>(null);

function useCommandContext() {
	const context = React.useContext(CommandContext);

	if (!context) {
		throw new Error("Command components must be used within <Command />");
	}

	return context;
}

function updateRegistry(
	registry: ItemRegistry,
	id: string,
	visible: boolean | null,
) {
	if (visible === null) {
		if (!registry.has(id)) {
			return registry;
		}

		const nextRegistry = new Map(registry);
		nextRegistry.delete(id);
		return nextRegistry;
	}

	if (registry.get(id) === visible) {
		return registry;
	}

	const nextRegistry = new Map(registry);
	nextRegistry.set(id, visible);
	return nextRegistry;
}

function getTextContent(node: React.ReactNode): string {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}

	if (Array.isArray(node)) {
		return node.map(getTextContent).join(" ");
	}

	if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
		return getTextContent(node.props.children);
	}

	return "";
}

export type CommandProps = Omit<
	React.ComponentProps<"div">,
	"onChange" | "value"
> & {
	value?: string;
	onValueChange?: (value: string) => void;
};

function Command({
	className,
	children,
	value,
	onValueChange,
	...props
}: CommandProps) {
	const [query, setQuery] = React.useState("");
	const [items, setItems] = React.useState<ItemRegistry>(() => new Map());
	const [registrationSettled, setRegistrationSettled] = React.useState(false);

	React.useEffect(() => {
		setRegistrationSettled(true);
	}, []);

	const registerItem = React.useCallback((id: string, visible: boolean) => {
		setItems((current) => updateRegistry(current, id, visible));

		return () => {
			setItems((current) => updateRegistry(current, id, null));
		};
	}, []);

	const selectItem = React.useCallback(
		(itemValue: string) => {
			onValueChange?.(itemValue);
		},
		[onValueChange],
	);

	const visibleItemCount = React.useMemo(
		() => Array.from(items.values()).filter(Boolean).length,
		[items],
	);

	const context = React.useMemo(
		() => ({
			query,
			selectedValue: value,
			registerItem,
			selectItem,
			visibleItemCount,
			registrationSettled,
		}),
		[
			query,
			value,
			registerItem,
			selectItem,
			visibleItemCount,
			registrationSettled,
		],
	);

	return (
		<CommandContext.Provider value={context}>
			<AutocompletePrimitive.Root
				autoHighlight
				inline
				mode="none"
				onOpenChange={(nextOpen, eventDetails) => {
					if (!nextOpen && eventDetails.reason === "escape-key") {
						eventDetails.allowPropagation();
					}
				}}
				onValueChange={setQuery}
				open
				value={query}
			>
				<div
					data-slot="command"
					className={cn(
						"flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
						className,
					)}
					{...props}
				>
					{children}
				</div>
			</AutocompletePrimitive.Root>
		</CommandContext.Provider>
	);
}

export type CommandDialogProps = Omit<
	React.ComponentProps<typeof Dialog>,
	"children"
> & {
	title?: string;
	description?: string;
	className?: string;
	showCloseButton?: boolean;
	children: React.ReactNode;
};

function CommandDialog({
	title = "Command Palette",
	description = "Search for a command to run...",
	children,
	className,
	showCloseButton = false,
	...props
}: CommandDialogProps) {
	return (
		<Dialog {...props}>
			<DialogContent
				className={cn(
					"top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
					className,
				)}
				showCloseButton={showCloseButton}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<Command>{children}</Command>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Input>) {
	return (
		<div data-slot="command-input-wrapper" className="p-1 pb-0">
			<InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
				<AutocompletePrimitive.Input
					autoComplete="off"
					data-slot="command-input"
					className={cn(
						"w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					{...props}
				/>
				<InputGroupAddon>
					<SearchIcon className="size-4 shrink-0 opacity-50" />
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
}

function CommandList({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.List>) {
	return (
		<AutocompletePrimitive.List
			data-slot="command-list"
			className={cn(
				"no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
				className,
			)}
			{...props}
		/>
	);
}

function CommandEmpty({
	className,
	children,
	...props
}: React.ComponentProps<"div">) {
	const { registrationSettled, visibleItemCount } = useCommandContext();

	return (
		<div
			data-slot="command-empty"
			className={cn(
				"py-6 text-center text-sm",
				(!registrationSettled || visibleItemCount > 0) && "hidden",
				className,
			)}
			role="status"
			{...props}
		>
			{children}
		</div>
	);
}

function CommandGroup({
	className,
	heading,
	children,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Group> & {
	heading?: React.ReactNode;
}) {
	const { query } = useCommandContext();
	const [items, setItems] = React.useState<ItemRegistry>(() => new Map());

	const registerItem = React.useCallback((id: string, visible: boolean) => {
		setItems((current) => updateRegistry(current, id, visible));

		return () => {
			setItems((current) => updateRegistry(current, id, null));
		};
	}, []);

	const visibleItemCount = React.useMemo(
		() => Array.from(items.values()).filter(Boolean).length,
		[items],
	);
	const groupContext = React.useMemo(() => ({ registerItem }), [registerItem]);

	return (
		<AutocompletePrimitive.Group
			data-slot="command-group"
			className={cn(
				"overflow-hidden p-1 text-foreground",
				query && items.size > 0 && visibleItemCount === 0 && "hidden",
				className,
			)}
			{...props}
		>
			{heading ? (
				<AutocompletePrimitive.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
					{heading}
				</AutocompletePrimitive.GroupLabel>
			) : null}
			<CommandGroupContext.Provider value={groupContext}>
				{children}
			</CommandGroupContext.Provider>
		</AutocompletePrimitive.Group>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof AutocompletePrimitive.Separator>) {
	return (
		<AutocompletePrimitive.Separator
			data-slot="command-separator"
			className={cn("-mx-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export type CommandItemProps = Omit<
	React.ComponentProps<typeof AutocompletePrimitive.Item>,
	"value"
> & {
	value?: string;
	keywords?: string[];
	onSelect?: (value: string) => void;
	showCheckmark?: boolean;
};

function CommandItem({
	className,
	children,
	value,
	keywords = [],
	onClick,
	onSelect,
	showCheckmark = true,
	...props
}: CommandItemProps) {
	const id = React.useId();
	const { query, selectedValue, registerItem, selectItem } =
		useCommandContext();
	const group = React.useContext(CommandGroupContext);
	const textValue = getTextContent(children).trim();
	const itemValue = value ?? textValue;
	const searchValue = [textValue, itemValue, ...keywords]
		.join(" ")
		.toLocaleLowerCase();
	const visible = searchValue.includes(query.trim().toLocaleLowerCase());

	React.useLayoutEffect(
		() => registerItem(id, visible),
		[id, registerItem, visible],
	);
	React.useLayoutEffect(
		() => group?.registerItem(id, visible),
		[group, id, visible],
	);

	if (!visible) {
		return null;
	}

	return (
		<AutocompletePrimitive.Item
			data-slot="command-item"
			data-checked={selectedValue === itemValue}
			className={cn(
				"group/command-item relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-highlighted:*:[svg]:text-foreground",
				className,
			)}
			value={itemValue}
			onClick={(event) => {
				onClick?.(event);

				if (!event.defaultPrevented) {
					selectItem(itemValue);
					onSelect?.(itemValue);
				}
			}}
			{...props}
		>
			{children}
			{showCheckmark && (
				<CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
			)}
		</AutocompletePrimitive.Item>
	);
}

function CommandShortcut({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="command-shortcut"
			className={cn(
				"ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/command-item:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export type CommandElement = import("react").ComponentRef<typeof Command>;
export type CommandInputElement = import("react").ComponentRef<
	typeof CommandInput
>;
export type CommandInputProps = import("react").ComponentProps<
	typeof CommandInput
>;
export type CommandListElement = import("react").ComponentRef<
	typeof CommandList
>;
export type CommandListProps = import("react").ComponentProps<
	typeof CommandList
>;
export type CommandEmptyElement = import("react").ComponentRef<
	typeof CommandEmpty
>;
export type CommandEmptyProps = import("react").ComponentProps<
	typeof CommandEmpty
>;
export type CommandGroupElement = import("react").ComponentRef<
	typeof CommandGroup
>;
export type CommandGroupProps = import("react").ComponentProps<
	typeof CommandGroup
>;
export type CommandSeparatorElement = import("react").ComponentRef<
	typeof CommandSeparator
>;
export type CommandSeparatorProps = import("react").ComponentProps<
	typeof CommandSeparator
>;
export type CommandItemElement = import("react").ComponentRef<
	typeof CommandItem
>;
export type CommandShortcutElement = import("react").ComponentRef<
	typeof CommandShortcut
>;
export type CommandShortcutProps = import("react").ComponentProps<
	typeof CommandShortcut
>;

export {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
};
