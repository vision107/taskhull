"use client";

import type * as React from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	type SelectTriggerProps,
	SelectValue,
} from "@/components/ui/select";
import { organizationMemberRoleLabels } from "@/lib/auth/constants";
import type { OrganizationMemberRole } from "@/types/organization-member-role";

export type OrganizationRoleSelectProps = {
	value: OrganizationMemberRole;
	onSelect: (value: OrganizationMemberRole) => void;
	disabled?: boolean;
} & Omit<SelectTriggerProps, "children" | "disabled" | "onSelect" | "value">;

export function OrganizationRoleSelect({
	value,
	onSelect,
	disabled,
	...triggerProps
}: OrganizationRoleSelectProps): React.JSX.Element {
	const roleOptions = Object.entries(organizationMemberRoleLabels).map(
		([v, label]) => ({
			value: v,
			label,
		}),
	);

	return (
		<Select
			disabled={disabled}
			items={organizationMemberRoleLabels}
			onValueChange={(nextValue) => {
				if (nextValue) {
					onSelect(nextValue);
				}
			}}
			value={value}
		>
			<SelectTrigger {...triggerProps}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{roleOptions.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
