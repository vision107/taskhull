"use client";

import { CheckIcon, UserIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { trpc } from "@/trpc/client";

export interface AssigneeOption {
	userId: string;
	name: string;
	email?: string | null;
	image: string | null;
}

interface AssigneePickerProps {
	/** Current assignee user ID (null = unassigned). */
	value: string | null;
	onChange: (userId: string | null) => void;
	/** Optional explicit list of candidates (e.g. project members). Falls back to all org members. */
	candidates?: AssigneeOption[];
	/**
	 * Optional hydrated user info for the current `value`. Used as a fallback
	 * when the assigned user is not present in `candidates` (e.g. assigned to
	 * someone outside this project's member list). Prevents the chip from
	 * flipping to "Unassigned" visually.
	 */
	currentUser?: AssigneeOption | null;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	/** Render as compact avatar-only chip instead of full button with name. */
	compact?: boolean;
}

/**
 * Clickable chip that opens a popover to pick an assignee from org members.
 * Supports search, clear, and optional pre-narrowed candidate list.
 */
export function AssigneePicker({
	value,
	onChange,
	candidates,
	currentUser,
	placeholder = "Unassigned",
	className,
	disabled,
	compact = false,
}: AssigneePickerProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);

	const { data: orgMembers } = trpc.organization.listMembers.useQuery(
		undefined,
		{ enabled: candidates === undefined },
	);

	const options: AssigneeOption[] = React.useMemo(() => {
		const base: AssigneeOption[] = candidates
			? [...candidates]
			: (orgMembers?.map((m) => ({
					userId: m.userId,
					name: m.user.name,
					email: m.user.email,
					image: m.user.image,
				})) ?? []);

		// If the currently-assigned user isn't in the candidate list, append
		// them so the picker can still render and select them.
		if (
			value &&
			currentUser &&
			currentUser.userId === value &&
			!base.some((o) => o.userId === value)
		) {
			base.push(currentUser);
		}
		return base;
	}, [candidates, orgMembers, currentUser, value]);

	const current =
		options.find((o) => o.userId === value) ??
		(value && currentUser?.userId === value ? currentUser : null);

	const renderTrigger = () => {
		if (compact) {
			return (
				<button
					type="button"
					disabled={disabled}
					className={cn(
						"flex size-6 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					title={current?.name ?? placeholder}
				>
					{current ? (
						<Avatar className="size-6">
							<AvatarImage src={current.image ?? undefined} />
							<AvatarFallback className="text-[9px]">
								{current.name.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					) : (
						<div className="flex size-6 items-center justify-center rounded-full border border-dashed text-muted-foreground">
							<UserIcon className="size-3" />
						</div>
					)}
				</button>
			);
		}

		return (
			<button
				type="button"
				disabled={disabled}
				className={cn(
					"flex items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
			>
				{current ? (
					<>
						<Avatar className="size-5">
							<AvatarImage src={current.image ?? undefined} />
							<AvatarFallback className="text-[9px]">
								{current.name.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="truncate">{current.name}</span>
					</>
				) : (
					<>
						<div className="flex size-5 items-center justify-center rounded-full border border-dashed text-muted-foreground">
							<UserIcon className="size-3" />
						</div>
						<span className="text-muted-foreground">{placeholder}</span>
					</>
				)}
			</button>
		);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{renderTrigger()}</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-0">
				<Command>
					<CommandInput placeholder="Search member…" className="h-9" />
					<CommandList>
						<CommandEmpty>No members found.</CommandEmpty>
						<CommandGroup>
							<CommandItem
								value="__unassigned__"
								onSelect={() => {
									onChange(null);
									setOpen(false);
								}}
							>
								<div className="flex size-5 items-center justify-center rounded-full border border-dashed text-muted-foreground">
									<UserIcon className="size-3" />
								</div>
								<span className="flex-1">Unassigned</span>
								{value === null && <CheckIcon className="size-3.5" />}
							</CommandItem>
							{options.map((opt) => (
								<CommandItem
									key={opt.userId}
									value={`${opt.name} ${opt.email ?? ""}`}
									onSelect={() => {
										onChange(opt.userId);
										setOpen(false);
									}}
								>
									<Avatar className="size-5">
										<AvatarImage src={opt.image ?? undefined} />
										<AvatarFallback className="text-[9px]">
											{opt.name.slice(0, 2).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-1 flex-col overflow-hidden">
										<span className="truncate text-sm">{opt.name}</span>
										{opt.email && (
											<span className="truncate text-[10px] text-muted-foreground">
												{opt.email}
											</span>
										)}
									</div>
									{value === opt.userId && <CheckIcon className="size-3.5" />}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/**
 * Small "x" button that clears an assignee inline. Render next to the picker
 * when you want explicit clear without opening the popover.
 */
export function ClearAssigneeButton({
	onClear,
	className,
}: {
	onClear: () => void;
	className?: string;
}): React.JSX.Element {
	return (
		<button
			type="button"
			onClick={onClear}
			className={cn(
				"text-muted-foreground transition-colors hover:text-foreground",
				className,
			)}
			title="Clear assignee"
		>
			<XIcon className="size-3" />
		</button>
	);
}
