"use client";

import NiceModal from "@ebay/nice-modal-react";
import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
} from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { MoreVerticalIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { OrganizationRoleSelect } from "@/components/organization/organization-role-select";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user/user-avatar";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";
import { organizationMemberRoleLabels } from "@/lib/auth/constants";
import { canChangeOrganizationRole } from "@/lib/auth/organization-permissions";
import { isOrganizationAdmin } from "@/lib/auth/utils";
import { trpc } from "@/trpc/client";
import type { OrganizationMemberRole } from "@/types/organization-member-role";

export type OrganizationMembersTableProps = {
	organizationId: string;
};

export function OrganizationMembersTable({
	organizationId,
}: OrganizationMembersTableProps): React.JSX.Element {
	const { user } = useSession();
	const utils = trpc.useUtils();
	const { data: organization } = trpc.organization.get.useQuery({
		id: organizationId,
	});
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);

	const userIsOrganizationAdmin = isOrganizationAdmin(organization, user);
	const currentMemberRole = organization?.members.find(
		(member) => member.userId === user?.id,
	)?.role;

	const updateMemberRole = (memberId: string, role: OrganizationMemberRole) => {
		toast.promise(
			async () => {
				await authClient.organization.updateMemberRole({
					memberId,
					role,
					organizationId,
				});
			},
			{
				loading: "Updating membership...",
				success: () => {
					void utils.organization.get.invalidate({ id: organizationId });
					return "Membership updated successfully.";
				},
				error: "Could not update membership. Please try again.",
			},
		);
	};

	const removeMember = async (
		memberId: string,
		isCurrentUser: boolean,
	): Promise<boolean> => {
		const toastId = toast.loading(
			isCurrentUser ? "Leaving organization..." : "Removing member...",
		);

		try {
			const { error } = await authClient.organization.removeMember({
				memberIdOrEmail: memberId,
				organizationId,
			});

			if (error) {
				throw error;
			}

			await Promise.all([
				utils.organization.get.invalidate({ id: organizationId }),
				utils.organization.list.invalidate(),
			]);
			toast.success(
				isCurrentUser
					? "You left the organization."
					: "Member removed successfully.",
				{ id: toastId },
			);
			return true;
		} catch {
			toast.error(
				isCurrentUser
					? "Could not leave the organization. Please try again."
					: "Could not remove member. Please try again.",
				{ id: toastId },
			);
			return false;
		}
	};

	const confirmMemberRemoval = ({
		memberId,
		memberName,
		isCurrentUser,
	}: {
		memberId: string;
		memberName: string;
		isCurrentUser: boolean;
	}) => {
		void NiceModal.show(ConfirmationModal, {
			title: isCurrentUser ? "Leave organization" : "Remove member",
			message: isCurrentUser
				? `Are you sure you want to leave "${organization?.name ?? "this organization"}"? You will immediately lose access to it.`
				: `Are you sure you want to remove ${memberName} from "${organization?.name ?? "this organization"}"? They will immediately lose access to it.`,
			destructive: true,
			confirmLabel: isCurrentUser ? "Leave organization" : "Remove member",
			onConfirm: () => removeMember(memberId, isCurrentUser),
		});
	};

	const columns: ColumnDef<
		NonNullable<typeof organization>["members"][number]
	>[] = [
		{
			accessorKey: "user",
			header: "",
			accessorFn: (row) => row.user,
			cell: ({ row }) =>
				row.original.user ? (
					<div className="flex items-center gap-4">
						<UserAvatar
							className="size-6"
							name={row.original.user.name ?? row.original.user.email}
							src={row.original.user?.image}
						/>
						<div>
							<strong className="block leading-none font-medium">
								{row.original.user.name}
							</strong>
							<small className="text-foreground/60">
								{row.original.user.email}
							</small>
						</div>
					</div>
				) : null,
		},
		{
			accessorKey: "actions",
			header: "",
			cell: ({ row }) => {
				return (
					<div className="flex flex-row justify-end gap-2">
						{userIsOrganizationAdmin ? (
							<>
								<OrganizationRoleSelect
									allowOwner={currentMemberRole === "owner"}
									disabled={
										!canChangeOrganizationRole({
											actorRole: currentMemberRole,
											currentRole: row.original.role,
											nextRole: row.original.role,
										})
									}
									onSelect={async (value) =>
										updateMemberRole(row.original.id, value)
									}
									value={row.original.role}
								/>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											disabled={
												organization?.members && organization.members.length < 2
											}
											size="icon"
											type="button"
											variant="ghost"
										>
											<MoreVerticalIcon className="size-4 shrink-0" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent>
										{row.original.userId !== user?.id && (
											<DropdownMenuItem
												className="text-destructive"
												disabled={!isOrganizationAdmin(organization, user)}
												onClick={() =>
													confirmMemberRemoval({
														memberId: row.original.id,
														memberName:
															row.original.user?.name ??
															row.original.user?.email ??
															"this member",
														isCurrentUser: false,
													})
												}
											>
												Remove member
											</DropdownMenuItem>
										)}
										{row.original.userId === user?.id && (
											<DropdownMenuItem
												className="text-destructive"
												onClick={() =>
													confirmMemberRemoval({
														memberId: row.original.id,
														memberName:
															row.original.user?.name ??
															row.original.user?.email ??
															"your account",
														isCurrentUser: true,
													})
												}
											>
												Leave organization
											</DropdownMenuItem>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							</>
						) : (
							<span className="text-sm font-medium text-foreground/60">
								{
									organizationMemberRoleLabels[
										row.original
											.role as keyof typeof organizationMemberRoleLabels
									]
								}
							</span>
						)}
					</div>
				);
			},
		},
	];

	const table = useReactTable({
		data: organization?.members ?? [],
		columns,
		manualPagination: true,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		state: {
			sorting,
			columnFilters,
		},
	});

	return (
		<Table>
			<TableBody>
				{table.getRowModel().rows?.length ? (
					table.getRowModel().rows.map((row) => (
						<TableRow
							data-state={row.getIsSelected() && "selected"}
							key={row.id}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))
				) : (
					<TableRow>
						<TableCell className="h-24 text-center" colSpan={columns.length}>
							No results.
						</TableCell>
					</TableRow>
				)}
			</TableBody>
		</Table>
	);
}
