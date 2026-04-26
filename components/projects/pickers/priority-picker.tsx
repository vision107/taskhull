"use client";

import {
	AlertCircleIcon,
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	MinusIcon,
} from "lucide-react";
import * as React from "react";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type TaskPriorityValue =
	| "none"
	| "low"
	| "medium"
	| "high"
	| "urgent";

export const PRIORITY_META: Record<
	TaskPriorityValue,
	{
		label: string;
		icon: React.ComponentType<{ className?: string }>;
		color: string;
	}
> = {
	urgent: { label: "Urgent", icon: AlertCircleIcon, color: "text-red-500" },
	high: { label: "High", icon: ArrowUpIcon, color: "text-orange-500" },
	medium: { label: "Medium", icon: MinusIcon, color: "text-yellow-500" },
	low: { label: "Low", icon: ArrowDownIcon, color: "text-blue-400" },
	none: { label: "None", icon: MinusIcon, color: "text-muted-foreground" },
};

const ORDER: TaskPriorityValue[] = ["urgent", "high", "medium", "low", "none"];

interface PriorityPickerProps {
	value: TaskPriorityValue;
	onChange: (priority: TaskPriorityValue) => void;
	className?: string;
	disabled?: boolean;
	/** Render icon-only chip; otherwise render with label. */
	compact?: boolean;
}

export function PriorityPicker({
	value,
	onChange,
	className,
	disabled,
	compact = false,
}: PriorityPickerProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const current = PRIORITY_META[value];
	const Icon = current.icon;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					title={current.label}
					className={cn(
						"flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
						compact && "size-6 justify-center px-0 py-0",
						className,
					)}
				>
					<Icon className={cn("size-3.5 shrink-0", current.color)} />
					{!compact && <span className="truncate">{current.label}</span>}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-44 p-0">
				<Command>
					<CommandList>
						<CommandGroup>
							{ORDER.map((p) => {
								const meta = PRIORITY_META[p];
								const MetaIcon = meta.icon;
								return (
									<CommandItem
										key={p}
										value={p}
										onSelect={() => {
											onChange(p);
											setOpen(false);
										}}
									>
										<MetaIcon className={cn("size-3.5", meta.color)} />
										<span className="flex-1">{meta.label}</span>
										{p === value && <CheckIcon className="size-3.5" />}
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
