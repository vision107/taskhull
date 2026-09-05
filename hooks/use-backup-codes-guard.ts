"use client";

import * as React from "react";

export function useBackupCodesGuard(active: boolean): void {
	React.useEffect(() => {
		if (!active) {
			return;
		}

		const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
			event.preventDefault();
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [active]);
}
