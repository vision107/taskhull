"use client";

import { format, isPast, isToday } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
	value: Date | null | undefined;
	onChange: (date: Date | null) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	/** When true, overdue dates get a red tint. Useful for due dates. */
	highlightOverdue?: boolean;
	/** Format string, defaults to "MMM d, yyyy". */
	format?: string;
}

/**
 * Clickable chip that opens a calendar popover. Null value = no date.
 */
export function DatePicker({
	value,
	onChange,
	placeholder = "Set date",
	className,
	disabled,
	highlightOverdue = false,
	format: formatStr = "MMM d, yyyy",
}: DatePickerProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);

	const date = value ?? null;
	const overdue =
		highlightOverdue &&
		date !== null &&
		isPast(date) &&
		!isToday(date);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={cn(
						"flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
						overdue && "border-red-500/40 text-red-600 hover:bg-red-500/10",
						className,
					)}
				>
					<CalendarIcon className="size-3 shrink-0" />
					{date ? (
						<span className="truncate">{format(date, formatStr)}</span>
					) : (
						<span className="text-muted-foreground">{placeholder}</span>
					)}
					{date && (
						<span
							role="button"
							aria-label="Clear date"
							tabIndex={0}
							onClick={(e) => {
								e.stopPropagation();
								e.preventDefault();
								onChange(null);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.stopPropagation();
									e.preventDefault();
									onChange(null);
								}
							}}
							className="ml-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
							title="Clear date"
						>
							<XIcon className="size-3" />
						</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar
					mode="single"
					selected={date ?? undefined}
					onSelect={(d) => {
						onChange(d ?? null);
						setOpen(false);
					}}
					autoFocus
				/>
				<div className="flex justify-between border-t p-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							onChange(null);
							setOpen(false);
						}}
					>
						Clear
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							onChange(new Date());
							setOpen(false);
						}}
					>
						Today
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
