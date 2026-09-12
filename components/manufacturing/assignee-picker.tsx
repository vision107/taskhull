"use client";

import { CheckIcon, UserPlusIcon } from "lucide-react";
import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
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
import { UserAvatar } from "@/components/user/user-avatar";
import { trpc } from "@/trpc/client";

export type Assignee = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	role: string;
};

type AssigneePickerProps = {
	/** Currently assigned user ids (shown with a check mark). */
	selectedIds?: string[];
	onSelect: (user: Assignee) => void;
	/** Shown when a currently selected user is picked again. */
	onDeselect?: (user: Assignee) => void;
	disabled?: boolean;
	label?: React.ReactNode;
	buttonProps?: ButtonProps;
	children?: React.ReactNode;
};

/**
 * Popover with a searchable list of organization members. Used to assign a
 * worker to one task, a build, or a whole column of tasks across builds.
 */
export function AssigneePicker({
	selectedIds = [],
	onSelect,
	onDeselect,
	disabled,
	label,
	buttonProps,
	children,
}: AssigneePickerProps): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const { data: members, isLoading } =
		trpc.organization.build.assignees.useQuery(undefined, {
			enabled: open || selectedIds.length > 0,
		});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				{children ?? (
					<Button
						variant="outline"
						size="sm"
						disabled={disabled}
						{...buttonProps}
					>
						<UserPlusIcon />
						{label ?? "Assign"}
					</Button>
				)}
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search members…" />
					<CommandList>
						<CommandEmpty>
							{isLoading ? "Loading…" : "No members found."}
						</CommandEmpty>
						<CommandGroup>
							{(members ?? []).map((member) => {
								const selected = selectedIds.includes(member.id);
								return (
									<CommandItem
										key={member.id}
										value={member.id}
										keywords={[member.name, member.email]}
										onSelect={() => {
											if (selected) {
												onDeselect?.(member);
											} else {
												onSelect(member);
											}
											setOpen(false);
										}}
									>
										<UserAvatar
											name={member.name}
											src={member.image}
											className="size-6"
											fallbackClassName="text-[10px]"
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate">{member.name}</p>
											<p className="truncate text-xs text-muted-foreground">
												{member.email}
											</p>
										</div>
										{selected && <CheckIcon className="size-4" />}
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
