"use client";

import { CopyIcon, DownloadIcon } from "lucide-react";
import type * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type BackupCodesPanelProps = {
	backupCodes: string[];
	saved: boolean;
	onSavedChange: (saved: boolean) => void;
};

export function BackupCodesPanel({
	backupCodes,
	saved,
	onSavedChange,
}: BackupCodesPanelProps): React.JSX.Element {
	const codesText = backupCodes.join("\n");

	const handleCopy = async (): Promise<void> => {
		try {
			await navigator.clipboard.writeText(codesText);
			toast.success("Backup codes copied to clipboard.");
		} catch {
			toast.error("Backup codes could not be copied.");
		}
	};

	const handleDownload = (): void => {
		const blob = new Blob([codesText], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "backup-codes.txt";
		link.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="flex flex-col gap-4">
			<p className="text-sm text-muted-foreground">
				Save these backup codes somewhere safe. Each code can be used once if
				you lose access to your authenticator app.
			</p>
			<div
				aria-label="Backup codes"
				className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border bg-muted/50 p-4 font-mono text-sm sm:grid-cols-2"
			>
				{backupCodes.map((code) => (
					<div key={code}>{code}</div>
				))}
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					onClick={() => void handleCopy()}
					type="button"
					variant="outline"
				>
					<CopyIcon className="size-4" />
					Copy codes
				</Button>
				<Button onClick={handleDownload} type="button" variant="outline">
					<DownloadIcon className="size-4" />
					Download codes
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<Checkbox
					checked={saved}
					id="backup-codes-saved"
					onCheckedChange={(value) => onSavedChange(value === true)}
				/>
				<Label htmlFor="backup-codes-saved">I saved these codes</Label>
			</div>
		</div>
	);
}
