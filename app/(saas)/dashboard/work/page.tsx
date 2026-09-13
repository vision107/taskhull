import type { Metadata } from "next";
import type * as React from "react";

import { MyTasksList } from "@/components/work/my-tasks-list";
import { getSession } from "@/lib/auth/server";
import { getWorkDictionary, resolveWorkLocale } from "@/lib/i18n/work";

export async function generateMetadata(): Promise<Metadata> {
	const session = await getSession();
	const locale = resolveWorkLocale(
		(session?.user as { locale?: string | null } | undefined)?.locale,
	);
	return { title: getWorkDictionary(locale).list.title };
}

export default function WorkPage(): React.JSX.Element {
	return <MyTasksList />;
}
