"use client";

import type { Locale as DateFnsLocale } from "date-fns";
import * as React from "react";

import { useSession } from "@/hooks/use-session";
import {
	getWorkDictionary,
	resolveWorkLocale,
	type WorkDictionary,
	type WorkLocale,
	workDateLocale,
} from "@/lib/i18n/work";
import { trpc } from "@/trpc/client";

interface WorkLocaleContextValue {
	locale: WorkLocale;
	t: WorkDictionary;
	dateLocale: DateFnsLocale;
	setLocale: (locale: WorkLocale) => Promise<void>;
	saving: boolean;
}

const WorkLocaleContext = React.createContext<WorkLocaleContextValue | null>(
	null,
);

/**
 * Language for the worker PWA. Server-rendered with the user's saved
 * preference (so there is no flash), refined with the browser language on
 * the client when nothing is saved yet.
 */
export function WorkLocaleProvider({
	initialLocale,
	children,
}: React.PropsWithChildren<{
	initialLocale: string | null;
}>): React.JSX.Element {
	const { user, reloadSession } = useSession();
	const savedLocale =
		(user as { locale?: string | null } | null)?.locale ?? initialLocale;
	const [browserLanguage, setBrowserLanguage] = React.useState<string | null>(
		null,
	);
	const [override, setOverride] = React.useState<WorkLocale | null>(null);

	React.useEffect(() => {
		setBrowserLanguage(navigator.language);
	}, []);

	const locale = override ?? resolveWorkLocale(savedLocale, browserLanguage);

	React.useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const mutation = trpc.user.setLocale.useMutation();
	const setLocale = React.useCallback(
		async (next: WorkLocale) => {
			setOverride(next);
			try {
				await mutation.mutateAsync({ locale: next });
				await reloadSession();
			} catch {
				// Keep the optimistic choice for this session; it just isn't saved.
			}
		},
		[mutation, reloadSession],
	);

	const value = React.useMemo<WorkLocaleContextValue>(
		() => ({
			locale,
			t: getWorkDictionary(locale),
			dateLocale: workDateLocale[locale],
			setLocale,
			saving: mutation.isPending,
		}),
		[locale, setLocale, mutation.isPending],
	);

	return (
		<WorkLocaleContext.Provider value={value}>
			{children}
		</WorkLocaleContext.Provider>
	);
}

export function useWorkLocale(): WorkLocaleContextValue {
	const value = React.useContext(WorkLocaleContext);
	if (!value) {
		throw new Error("useWorkLocale must be used inside <WorkLocaleProvider>");
	}
	return value;
}

/** Shorthand: just the dictionary. */
export function useWorkT(): WorkDictionary {
	return useWorkLocale().t;
}
