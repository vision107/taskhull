"use client";

import * as React from "react";

export function useCallbackRef<T extends (...args: unknown[]) => unknown>(
	callback: T | undefined,
) {
	const callbackRef = React.useRef(callback);

	React.useEffect(() => {
		callbackRef.current = callback;
	});

	return React.useCallback(
		((...args) => callbackRef.current?.(...args)) as T,
		[],
	);
}
