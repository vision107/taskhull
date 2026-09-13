"use client";

import { addDays, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const defaultPresets = [
	{ value: 0, label: "Today" },
	{ value: 1, label: "Tomorrow" },
	{ value: 3, label: "In 3 days" },
	{ value: 7, label: "In a week" },
];

export type DatePickerProps = ButtonProps & {
	date?: Date;
	onDateChange?: (date?: Date) => void;
	placeholder?: string;
	presets?: { value: number; label: string }[];
	/** date-fns format for the trigger label. Defaults to "PPP". */
	dateFormat?: string;
};
function DatePicker({
	date,
	onDateChange,
	placeholder = "Pick a date",
	presets = defaultPresets,
	dateFormat = "PPP",
	className,
	variant,
	...other
}: DatePickerProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const pick = (next?: Date) => {
		onDateChange?.(next);
		setOpen(false);
	};
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant={variant || "outline"}
					className={cn(
						"min-w-0 justify-start overflow-hidden text-left font-normal whitespace-nowrap",
						!date && "text-muted-foreground",
						className,
					)}
					{...other}
				>
					<CalendarIcon className="mr-2 size-4 shrink-0" />
					<span className="truncate">
						{date ? format(date, dateFormat) : placeholder}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="center"
				className="flex w-auto flex-row gap-2 divide-x p-2"
			>
				<ul className="w-full list-none space-y-1">
					{presets.map((preset) => (
						<li key={preset.value}>
							<Button
								type="button"
								variant="ghost"
								className="w-full justify-start"
								onClick={() => pick(addDays(new Date(), preset.value))}
							>
								{preset.label}
							</Button>
						</li>
					))}
				</ul>
				<Calendar
					mode="single"
					selected={date}
					defaultMonth={date}
					onSelect={pick}
				/>
			</PopoverContent>
		</Popover>
	);
}

export type DateRangePickerElement = HTMLDivElement;
export type DateRangePickerProps = React.HTMLAttributes<HTMLDivElement> & {
	dateRange?: DateRange;
	onDateRangeChange?: (range?: DateRange) => void;
	disabled?: boolean;
};
function DateRangePicker({
	dateRange,
	onDateRangeChange,
	disabled,
	className,
	...other
}: DateRangePickerProps): React.JSX.Element {
	return (
		<div className={cn("grid gap-2", className)} {...other}>
			<Popover>
				<PopoverTrigger asChild>
					<Button
						id="date"
						variant="outline"
						className={cn(
							"w-[260px] justify-start text-left font-normal",
							!dateRange && "text-muted-foreground",
						)}
						disabled={disabled}
					>
						<CalendarIcon className="size-4 shrink-0" />
						{dateRange?.from ? (
							dateRange.to ? (
								<>
									{format(dateRange.from, "LLL dd, y")} -{" "}
									{format(dateRange.to, "LLL dd, y")}
								</>
							) : (
								format(dateRange.from, "LLL dd, y")
							)
						) : (
							<span>Pick a date</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="end">
					<Calendar
						// oxlint-disable-next-line jsx-a11y/no-autofocus -- keyboard users should enter the opened range calendar immediately
						autoFocus
						mode="range"
						defaultMonth={dateRange?.from}
						selected={dateRange}
						onSelect={(d) => {
							onDateRangeChange?.(d);
						}}
						numberOfMonths={2}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}

export { DatePicker, DateRangePicker, type DateRange };
