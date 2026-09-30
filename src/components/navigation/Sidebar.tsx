"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { ADMIN_ICON, Avatar, Logo, NAV_ITEMS, initialsOf, isActivePath } from "./navItems";

/** Schwebende Desktop-Seitenleiste (ab md). */
export default function Sidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = session?.user?.role === "admin";
  const initials = initialsOf(session?.user?.name, session?.user?.email);

  // Menü bei Klick außerhalb oder Escape schließen.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const linkClass = (active: boolean) =>
    `group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
      active
        ? "bg-neutral-900 text-neutral-50 shadow-lg shadow-neutral-900/15"
        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
    }`;

  return (
    <aside className="glass hidden rounded-[28px] shadow-[var(--shadow-card)] md:fixed md:inset-y-3 md:left-3 md:z-30 md:flex md:w-60 md:flex-col">
      <div className="px-5 pb-2 pt-6">
        <Link href="/dashboard" aria-label="Brick – Startseite">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Hauptnavigation">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(active)}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {active && item.dot ? <span className={`h-2 w-2 rounded-full ${item.dot}`} /> : null}
            </Link>
          );
        })}
      </nav>

      {/* Nutzer-Karte */}
      <div className="relative p-3" ref={menuRef}>
        {menuOpen && (
          <div className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl">
            <Link href="/profile" className="block rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
              Profil
            </Link>
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
                <span className="h-4 w-4">{ADMIN_ICON}</span>
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/auth/login" })}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Abmelden
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-3 rounded-2xl bg-neutral-100/70 px-2.5 py-2 text-left transition hover:bg-neutral-100"
        >
          <Avatar initials={initials} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{session?.user?.name || "Nutzer"}</p>
            <p className="truncate text-xs text-neutral-500">{session?.user?.email}</p>
          </div>
          <svg
            className={`h-4 w-4 flex-shrink-0 text-neutral-400 transition ${menuOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 15 6-6 6 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
