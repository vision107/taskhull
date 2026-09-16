"use client";

import type { LucideIcon } from "lucide-react";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

import { useSidebar } from "@/components/ui/sidebar";
import { useWorkT } from "@/components/work/work-locale-provider";
import { cn } from "@/lib/utils";

export interface BottomNavItem {
	label: string;
	href: string;
	icon: LucideIcon;
	/** Defaults to a `startsWith` match on the pathname. */
	exact?: boolean;
}

/** Height of the bar without the safe-area inset; keep in sync with `--bottom-nav`. */
export const BOTTOM_NAV_HEIGHT_CLASS = "h-14";

/**
 * Phone tab bar for the dashboard shell. Shows up to four primary
 * destinations plus a "Menu" tab that opens the full sidebar as a sheet, so
 * nothing that exists on desktop is unreachable on a phone.
 */
export function BottomNav({
	items,
}: {
	items: BottomNavItem[];
}): React.JSX.Element {
	const pathname = usePathname();
	const { toggleSidebar, openMobile } = useSidebar();
	const t = useWorkT();

	const isActive = (item: BottomNavItem) =>
		item.exact ? pathname === item.href : pathname.startsWith(item.href);

	return (
		<nav
			aria-label={t.nav.label}
			className="fixed inset-x-0 bottom-0 z-30 border-t border-subtle bg-surface-1/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
		>
			<ul
				className={cn(
					"grid w-full",
					BOTTOM_NAV_HEIGHT_CLASS,
					items.length === 1 && "grid-cols-2",
					items.length === 2 && "grid-cols-3",
					items.length === 3 && "grid-cols-4",
					items.length >= 4 && "grid-cols-5",
				)}
			>
				{items.slice(0, 4).map((item) => {
					const active = isActive(item);
					return (
						<li key={item.href} className="flex">
							<Link
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
									active
										? "text-foreground"
										: "text-fg-tertiary hover:text-foreground",
								)}
							>
								<item.icon
									className={cn("size-5", active && "text-primary")}
									aria-hidden="true"
								/>
								<span className="truncate">{item.label}</span>
							</Link>
						</li>
					);
				})}
				<li className="flex">
					<button
						type="button"
						onClick={toggleSidebar}
						aria-expanded={openMobile}
						className={cn(
							"flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
							openMobile
								? "text-foreground"
								: "text-fg-tertiary hover:text-foreground",
						)}
					>
						<MenuIcon className="size-5" aria-hidden="true" />
						<span className="truncate">{t.nav.menu}</span>
					</button>
				</li>
			</ul>
		</nav>
	);
}
