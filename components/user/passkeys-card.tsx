"use client";

import { getAuthenticatorName, type Passkey } from "@better-auth/passkey";
import NiceModal from "@ebay/nice-modal-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRoundIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type * as React from "react";
import { toast } from "sonner";

import { ConfirmationModal } from "@/components/confirmation-modal";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { RenamePasskeyModal } from "@/components/user/rename-passkey-modal";
import { passkeysQueryKey, usePasskeys } from "@/hooks/use-passkeys";
import { authClient } from "@/lib/auth/client";
import { getAuthErrorMessage } from "@/lib/auth/constants";

function getErrorCode(error: unknown): string | undefined {
	return error && typeof error === "object" && "code" in error
		? String(error.code)
		: undefined;
}

function getPasskeyLabel(passkey: Passkey): string {
	return (
		passkey.name?.trim() ||
		getAuthenticatorName(passkey.aaguid) ||
		"Unnamed passkey"
	);
}

function getPasskeyDate(createdAt: Date): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
	}).format(new Date(createdAt));
}

export function PasskeysCard(): React.JSX.Element {
	const queryClient = useQueryClient();
	const passkeysQuery = usePasskeys();

	const addPasskeyMutation = useMutation({
		mutationFn: async () => {
			const { data, error } = await authClient.passkey.addPasskey();

			if (error) throw error;
			return data;
		},
		onSuccess: async (passkey) => {
			await queryClient.invalidateQueries({ queryKey: passkeysQueryKey });
			toast.success("Passkey added");

			if (passkey) {
				void NiceModal.show(RenamePasskeyModal, {
					passkeyId: passkey.id,
					currentName: passkey.name,
				});
			}
		},
		onError: (error) => toast.error(getAuthErrorMessage(getErrorCode(error))),
	});

	const deletePasskeyMutation = useMutation({
		mutationFn: async (id: string) => {
			const { error } = await authClient.passkey.deletePasskey({ id });
			if (error) throw error;
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: passkeysQueryKey });
			toast.success("Passkey deleted");
		},
		onError: () => toast.error("Could not delete passkey"),
	});

	const confirmDelete = (passkey: Passkey) => {
		void NiceModal.show(ConfirmationModal, {
			title: "Delete passkey",
			message: `Delete ${getPasskeyLabel(passkey)}? You will no longer be able to use it to sign in.`,
			confirmLabel: "Delete passkey",
			destructive: true,
			onConfirm: async () => {
				try {
					await deletePasskeyMutation.mutateAsync(passkey.id);
				} catch {
					return false;
				}
			},
		});
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Passkeys</CardTitle>
				<CardDescription>
					Sign in securely with your device instead of a password.
				</CardDescription>
				<CardAction>
					<Button
						loading={addPasskeyMutation.isPending}
						onClick={() => addPasskeyMutation.mutate()}
						type="button"
					>
						<PlusIcon data-icon="inline-start" />
						Add passkey
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{passkeysQuery.isPending ? (
					<div className="space-y-2" aria-label="Loading passkeys">
						{[0, 1].map((item) => (
							<div
								className="flex items-center gap-3 rounded-lg border p-3"
								key={item}
							>
								<Skeleton className="size-8 shrink-0" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-36" />
									<Skeleton className="h-3 w-24" />
								</div>
								<Skeleton className="size-7" />
								<Skeleton className="size-7" />
							</div>
						))}
					</div>
				) : passkeysQuery.isError ? (
					<Empty className="min-h-36 border">
						<EmptyHeader>
							<EmptyTitle>Could not load passkeys</EmptyTitle>
							<EmptyDescription>
								Try loading your passkeys again.
							</EmptyDescription>
						</EmptyHeader>
						<Button variant="outline" onClick={() => passkeysQuery.refetch()}>
							Try again
						</Button>
					</Empty>
				) : passkeysQuery.data.length === 0 ? (
					<Empty className="min-h-36 border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<KeyRoundIcon />
							</EmptyMedia>
							<EmptyTitle>No passkeys yet</EmptyTitle>
							<EmptyDescription>
								Add one to sign in with Touch ID, Face ID, Windows Hello, or a
								security key.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="divide-y rounded-lg border">
						{passkeysQuery.data.map((passkey) => (
							<div className="flex items-center gap-3 p-3" key={passkey.id}>
								<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
									<KeyRoundIcon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">
										{getPasskeyLabel(passkey)}
									</p>
									<p className="text-xs text-muted-foreground">
										Added {getPasskeyDate(passkey.createdAt)}
									</p>
								</div>
								<Button
									aria-label={`Rename ${getPasskeyLabel(passkey)}`}
									onClick={() =>
										NiceModal.show(RenamePasskeyModal, {
											passkeyId: passkey.id,
											currentName: passkey.name,
										})
									}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<PencilIcon />
								</Button>
								<Button
									aria-label={`Delete ${getPasskeyLabel(passkey)}`}
									onClick={() => confirmDelete(passkey)}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<Trash2Icon />
								</Button>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
