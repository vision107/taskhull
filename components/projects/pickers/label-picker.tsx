"use client";

import { CheckIcon, PlusIcon, TagIcon } from "lucide-react";
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

export interface LabelOption {
	id: string;
	name: string;
	color: string;
}

interface LabelPickerProps {
	value: string[];
	onChange: (labelIds: string[]) => void;
	options: LabelOption[];
	className?: string;
	disabled?: boolean;
	/** Show the selected labels as chips inline next to the trigger. */
	showChips?: boolean;
}

/**
 * Multi-select popover for task labels. Displays current labels as colored
 * chips in the trigger; popover has a searchable checkbox list.
 */
export function LabelPicker({
	value,
	onChange,
	options,
	className,
	disabled,
	showChips = true,
}: LabelPickerProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const selected = new Set(value);
	const selectedLabels = options.filter((o) => selected.has(o.id));

	const toggle = (id: string) => {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onChange(Array.from(next));
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={cn(
						"flex min-h-[28px] flex-wrap items-center gap-1 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
				>
					{showChips && selectedLabels.length > 0 ? (
						selectedLabels.map((l) => (
							<span
								key={l.id}
								className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
								style={{
									backgroundColor: `${l.color}25`,
									color: l.color,
								}}
							>
								{l.name}
							</span>
						))
					) : (
						<>
							<TagIcon className="size-3 text-muted-foreground" />
							<span className="text-muted-foreground">
								{value.length > 0
									? `${value.length} label${value.length === 1 ? "" : "s"}`
									: "Add labels"}
							</span>
						</>
					)}
					<PlusIcon className="ml-auto size-3 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-60 p-0">
				<Command>
					<CommandInput placeholder="Search labels…" className="h-9" />
					<CommandList>
						<CommandEmpty>No labels. Create some in Settings.</CommandEmpty>
						<CommandGroup>
							{options.map((opt) => {
								const active = selected.has(opt.id);
								return (
									<CommandItem
										key={opt.id}
										value={opt.name}
										onSelect={() => toggle(opt.id)}
									>
										<span
											className="h-3 w-3 rounded-full"
											style={{ backgroundColor: opt.color }}
										/>
										<span className="flex-1 truncate">{opt.name}</span>
										{active && <CheckIcon className="size-3.5" />}
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
