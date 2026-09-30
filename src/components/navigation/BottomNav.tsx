"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import {
  ADMIN_ICON,
  Avatar,
  MENU_ICON,
  NAV_ITEMS,
  initialsOf,
  isActivePath,
  type NavItem,
} from "./navItems";

/** Auf dem Handy passen nur wenige Tabs in eine Zeile – der Rest liegt im „Mehr“-Sheet. */
const PRIMARY_HREFS = ["/dashboard", "/week", "/race", "/coach"];
const primaryItems = NAV_ITEMS.filter((i) => PRIMARY_HREFS.includes(i.href));
const secondaryItems = NAV_ITEMS.filter((i) => !PRIMARY_HREFS.includes(i.href));

/** Schwebende Tab-Leiste (Mobil) mit „Mehr“-Sheet. */
export default function BottomNav({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isAdmin = session?.user?.role === "admin";
  const initials = initialsOf(session?.user?.name, session?.user?.email);

  // Sheet bei Navigation schließen.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Escape schließt das Sheet.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const secondaryActive =
    secondaryItems.some((i) => isActivePath(pathname, i.href)) ||
    isActivePath(pathname, "/profile") ||
    isActivePath(pathname, "/admin");

  const sheetLinks: NavItem[] = [
    ...secondaryItems,
    {
      href: "/profile",
      label: "Profil",
      icon: <Avatar initials={initials} size="h-full w-full text-[9px]" />,
    },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ADMIN_ICON }] : []),
  ];

  const tab = (active: boolean) =>
    `group flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors ${
      active ? "text-neutral-900" : "text-neutral-500 active:text-neutral-900"
    }`;

  const bubble = (active: boolean) =>
    `flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
      active ? "bg-neutral-900 text-neutral-50 scale-100" : "scale-95 group-active:scale-90"
    }`;

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Weitere Seiten">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-950/30 backdrop-blur-sm"
            aria-label="Schließen"
            onClick={() => setSheetOpen(false)}
          />
          <div className="animate-rise absolute inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] rounded-[28px] border border-neutral-200 bg-white p-3 shadow-2xl">
            <div className="grid grid-cols-3 gap-2">
              {sheetLinks.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-xs font-semibold transition active:scale-95 ${
                      active ? "bg-neutral-900 text-neutral-50" : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    <span className="h-6 w-6">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/auth/login" })}
              className="mt-2 w-full rounded-2xl bg-rose-50 py-3 text-sm font-semibold text-rose-600 active:scale-[0.98]"
            >
              Abmelden
            </button>
          </div>
        </div>
      )}

      <nav
        className="glass fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-50 rounded-[26px] shadow-[0_12px_32px_-12px_rgb(22_19_31/0.35)] md:hidden"
        aria-label="Hauptnavigation"
      >
        <div className="flex h-16 items-stretch px-1">
          {primaryItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={tab(active)}
                aria-current={active ? "page" : undefined}
              >
                <span className={bubble(active)}>
                  <span className="h-[22px] w-[22px]">{item.icon}</span>
                </span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            className={tab(sheetOpen || secondaryActive)}
            aria-expanded={sheetOpen}
            aria-label="Weitere Seiten"
          >
            <span className={bubble(sheetOpen || secondaryActive)}>
              <span className="h-[22px] w-[22px]">{MENU_ICON}</span>
            </span>
            <span>Mehr</span>
          </button>
        </div>
      </nav>
    </>
  );
}
