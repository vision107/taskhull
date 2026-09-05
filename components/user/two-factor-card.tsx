"use client";

import NiceModal from "@ebay/nice-modal-react";
import { KeyRoundIcon, ShieldCheck, ShieldCheckIcon } from "lucide-react";
import type * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RegenerateBackupCodesModal } from "@/components/user/regenerate-backup-codes-modal";
import { TwoFactorModal } from "@/components/user/two-factor-modal";
import { useSession } from "@/hooks/use-session";
import { trpc } from "@/trpc/client";

export type TwoFactorCardProps = {
	hasCredentialAccount?: boolean;
};

export function TwoFactorCard({
	hasCredentialAccount,
}: TwoFactorCardProps): React.JSX.Element {
	const { user } = useSession();

	const { data: accounts, isLoading } = trpc.user.getAccounts.useQuery(
		undefined,
		{
			enabled: hasCredentialAccount === undefined,
		},
	);

	const isCredentialAccount =
		hasCredentialAccount ??
		accounts?.some((account) => account.providerId === "credential");

	if (isCredentialAccount === undefined && isLoading) {
		return <Skeleton className="h-[218px] w-full" />;
	}

	const handleShowTwoFactorModal = () => {
		void NiceModal.show(TwoFactorModal);
	};
	const handleShowRegenerateBackupCodesModal = () => {
		void NiceModal.show(RegenerateBackupCodesModal);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Two-factor Authentication</CardTitle>
				<CardDescription>
					Set up Two-factor Authentication method to further secure your
					account.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isCredentialAccount === false ? (
					<div className="flex flex-col items-start gap-4">
						<Alert>
							<KeyRoundIcon className="size-4 shrink-0" />
							<AlertDescription>
								Two-factor authentication requires a password. Set a password
								for your account first, then return here to finish setup.
							</AlertDescription>
						</Alert>
						<Button
							type="button"
							variant="outline"
							onClick={() =>
								document
									.getElementById("set-password")
									?.scrollIntoView({ behavior: "smooth", block: "center" })
							}
						>
							Set a password first
						</Button>
					</div>
				) : user?.twoFactorEnabled ? (
					<div className="flex flex-col items-start gap-4">
						<Alert variant="success">
							<ShieldCheckIcon className="size-4 shrink-0 text-green-500" />
							<AlertDescription>
								You have two-factor authentication enabled for your account.
							</AlertDescription>
						</Alert>
						<div className="flex flex-wrap gap-2">
							<Button
								onClick={handleShowRegenerateBackupCodesModal}
								type="button"
								variant="outline"
							>
								Regenerate backup codes
							</Button>
							<Button
								onClick={handleShowTwoFactorModal}
								type="button"
								variant="default"
							>
								Disable Two-factor Authentication
							</Button>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-start gap-4">
						<Alert>
							<ShieldCheck className="size-4 shrink-0" />
							<AlertDescription>
								Secure your account with an extra layer of security.
							</AlertDescription>
						</Alert>
						<div className="flex justify-start">
							<Button
								type="button"
								variant="default"
								onClick={handleShowTwoFactorModal}
							>
								Set up a new Factor
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
