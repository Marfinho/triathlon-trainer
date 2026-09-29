"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const items: NavItem[] = [
  {
    href: "/dashboard",
    label: "Heute",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4V3" />
      </svg>
    ),
  },
  {
    href: "/week",
    label: "Woche",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/race",
    label: "Wettkampf",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: "/trainer",
    label: "Trainer",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="6" cy="17" r="3" strokeWidth={2} />
        <circle cx="18" cy="17" r="3" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 17l4-7h4l4 7M10 10l2-3h3" />
      </svg>
    ),
  },
  {
    href: "/body",
    label: "Körper",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm6 7a1 1 0 11-2 0 1 1 0 012 0zM7 20h10a2 2 0 002-2v-6a2 2 0 00-2-2H7a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/more",
    // „Mehr“ ist auf dem Handy der Sheet-Button selbst.
    label: "Extras",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
];

/** Auf dem Handy passen nur wenige Tabs in eine Zeile – der Rest liegt im „Mehr“-Sheet. */
const PRIMARY_HREFS = ["/dashboard", "/week", "/race", "/coach"];
const primaryItems = items.filter((i) => PRIMARY_HREFS.includes(i.href));
const secondaryItems = items.filter((i) => !PRIMARY_HREFS.includes(i.href));

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomNav({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isAdmin = session?.user?.role === "admin";
  const initials = (session?.user?.name || session?.user?.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
      icon: (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[9px] font-semibold text-white">
          {initials}
        </div>
      ),
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "Admin",
            icon: (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            ),
          },
        ]
      : []),
  ];

  const tabClass = (active: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors ${
      active ? "text-blue-600" : "text-gray-600 active:text-gray-900"
    }`;

  return (
    <>
      {sheetOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Weitere Seiten">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Schließen"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-4 pt-3 shadow-xl pb-[calc(76px+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
            <div className="grid grid-cols-3 gap-2">
              {sheetLinks.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium ${
                      active ? "bg-blue-50 text-blue-600" : "text-gray-700 active:bg-gray-100"
                    }`}
                  >
                    <div className="h-6 w-6">{item.icon}</div>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/auth/login" })}
              className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100"
            >
              Abmelden
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Hauptnavigation"
      >
        <div className="flex h-[60px] items-stretch">
          {primaryItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={tabClass(active)}
                aria-current={active ? "page" : undefined}
              >
                <div className="h-6 w-6">{item.icon}</div>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            className={tabClass(sheetOpen || secondaryActive)}
            aria-expanded={sheetOpen}
            aria-label="Weitere Seiten"
          >
            <div className="h-6 w-6">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <span>Mehr</span>
          </button>
        </div>
      </nav>
    </>
  );
}
