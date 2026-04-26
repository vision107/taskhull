"use client";

import {
	CheckCircle2Icon,
	CheckIcon,
	CircleDashedIcon,
	CircleIcon,
	XCircleIcon,
} from "lucide-react";
import * as React from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StatusOption {
	id: string;
	name: string;
	color: string;
	type: string;
}

export const STATUS_TYPE_ICON: Record<
	string,
	React.ComponentType<{ className?: string }>
> = {
	todo: CircleIcon,
	in_progress: CircleDashedIcon,
	done: CheckCircle2Icon,
	cancelled: XCircleIcon,
};

interface StatusPickerProps {
	value: string | null;
	onChange: (statusId: string | null) => void;
	options: StatusOption[];
	className?: string;
	disabled?: boolean;
	/** Hide the "No status" row; set when a status is required. */
	requireStatus?: boolean;
	/** Show only colored dot + name in trigger (no type icon). */
	compact?: boolean;
}

export function StatusPicker({
	value,
	onChange,
	options,
	className,
	disabled,
	requireStatus = false,
	compact = false,
}: StatusPickerProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const current = options.find((o) => o.id === value) ?? null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={cn(
						"flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
				>
					{current ? (
						<>
							<span
								className="h-2 w-2 shrink-0 rounded-full"
								style={{ backgroundColor: current.color }}
							/>
							{!compact && <span className="truncate">{current.name}</span>}
							{compact && <span className="truncate">{current.name}</span>}
						</>
					) : (
						<>
							<span className="h-2 w-2 shrink-0 rounded-full border border-dashed" />
							<span className="text-muted-foreground">No status</span>
						</>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-56 p-0">
				<Command>
					<CommandInput placeholder="Search statuses…" className="h-9" />
					<CommandList>
						<CommandEmpty>No statuses.</CommandEmpty>
						<CommandGroup>
							{!requireStatus && (
								<CommandItem
									value="__none__"
									onSelect={() => {
										onChange(null);
										setOpen(false);
									}}
								>
									<span className="h-2 w-2 rounded-full border border-dashed" />
									<span className="flex-1">No status</span>
									{value === null && <CheckIcon className="size-3.5" />}
								</CommandItem>
							)}
							{options.map((opt) => {
								const TypeIcon =
									STATUS_TYPE_ICON[opt.type] ?? CircleIcon;
								return (
									<CommandItem
										key={opt.id}
										value={opt.name}
										onSelect={() => {
											onChange(opt.id);
											setOpen(false);
										}}
									>
										<span
											className="h-2 w-2 shrink-0 rounded-full"
											style={{ backgroundColor: opt.color }}
										/>
										<TypeIcon className="size-3.5 text-muted-foreground" />
										<span className="flex-1 truncate">{opt.name}</span>
										{value === opt.id && <CheckIcon className="size-3.5" />}
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
