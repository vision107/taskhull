"use client";

import { CloudOffIcon, RefreshCwIcon } from "lucide-react";
import type * as React from "react";

import { useOffline } from "@/components/work/offline-provider";
import { useWorkT } from "@/components/work/work-locale-provider";
import { cn } from "@/lib/utils";

/**
 * Small floating indicator for connectivity and queued writes. Hidden while
 * online with nothing to sync, so it only appears when it matters. Sits above
 * the phone tab bar and in the bottom-right corner on larger screens.
 */
export function SyncStatusPill(): React.JSX.Element | null {
	const { online, pending, syncing, flush } = useOffline();
	const t = useWorkT();

	if (online && pending.length === 0) return null;

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav)+0.75rem)] z-30 flex justify-center px-4 md:inset-x-auto md:right-4 md:bottom-4">
			<button
				type="button"
				onClick={() => void flush()}
				disabled={!online || syncing}
				className={cn(
					"pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur",
					online
						? "border-warning/30 bg-warning-soft text-warning"
						: "border-subtle bg-layer-1 text-fg-secondary",
				)}
				aria-label={
					online
						? t.header.changesWaiting(pending.length)
						: t.header.youAreOffline
				}
			>
				{online ? (
					<RefreshCwIcon
						className={cn("size-3.5", syncing && "animate-spin")}
						aria-hidden="true"
					/>
				) : (
					<CloudOffIcon className="size-3.5" aria-hidden="true" />
				)}
				{online ? t.header.toSync(pending.length) : t.header.offline}
			</button>
		</div>
	);
}
