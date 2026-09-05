"use client";

import type * as React from "react";
import { toast } from "sonner";

import { OrganizationRoleSelect } from "@/components/organization/organization-role-select";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { getInviteMemberErrorMessage } from "@/lib/auth/invitation-errors";
import { inviteMemberSchema } from "@/schemas/organization-schemas";
import { trpc } from "@/trpc/client";

/**
 * Card component for inviting members to the organization.
 * Uses the active organization from session.
 */
interface OrganizationInviteMemberCardProps {
	canManage: boolean;
}

export function OrganizationInviteMemberCard({
	canManage,
}: OrganizationInviteMemberCardProps): React.JSX.Element {
	const { data: organization } = authClient.useActiveOrganization();
	const utils = trpc.useUtils();

	const methods = useZodForm({
		schema: inviteMemberSchema,
		defaultValues: {
			email: "",
			role: "member" as const,
		},
	});

	const onSubmit = methods.handleSubmit(async (values) => {
		if (!organization || !canManage) return;
		const email = values.email.trim().toLowerCase();

		try {
			// Better Auth uses the active organization from session when organizationId is not provided
			const { error } = await authClient.organization.inviteMember({
				...values,
				email,
				organizationId: organization.id,
			});

			if (error) throw error;

			methods.reset();
			await utils.organization.get.invalidate({ id: organization.id });
			toast.success("Invitation sent successfully.");
		} catch (err) {
			toast.error(getInviteMemberErrorMessage(err, email));
		}
	});

	return (
		<Card>
			<CardHeader className="flex flex-row justify-between">
				<div className="flex flex-col space-y-1.5">
					<CardTitle>Invite Member</CardTitle>
					<CardDescription>
						{canManage
							? "Send an invite to a team mate by email and assign them a role."
							: "Only organization owners and admins can invite members."}
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<Form {...methods}>
					<form onSubmit={onSubmit} className="@container">
						<FieldGroup className="flex flex-col gap-2 @md:flex-row">
							<div className="flex-1">
								<FormField
									control={methods.control}
									name="email"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Email address</FormLabel>
												<FormControl>
													<Input
														type="email"
														autoComplete="email"
														disabled={!canManage}
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							</div>
							<div>
								<FormField
									control={methods.control}
									name="role"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Role</FormLabel>
												<FormControl>
													<OrganizationRoleSelect
														value={field.value ?? "member"}
														onSelect={field.onChange}
														disabled={!canManage}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							</div>
						</FieldGroup>
						<div className="mt-4">
							<Button
								type="submit"
								loading={methods.formState.isSubmitting}
								disabled={!canManage}
							>
								Send Invite
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
