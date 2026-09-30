import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/navigation/navItems";

/**
 * Gemeinsamer Rahmen für /auth/login und /auth/register: zentrierte Karte auf
 * farbigen, langsam wandernden Blobs.
 */
export default function AuthFrame({
  title,
  subtitle,
  emoji,
  children,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 text-neutral-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="animate-blob absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
        <div className="animate-blob absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-coral/25 blur-3xl [animation-delay:-5s]" />
        <div className="animate-blob absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-lime-pop/30 blur-3xl [animation-delay:-9s]" />
      </div>

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center" aria-label="LocalHub – Startseite">
          <Logo className="scale-110" />
        </Link>

        <div className="animate-rise rounded-[32px] border border-neutral-200/70 bg-white p-6 shadow-[var(--shadow-card)] sm:p-9">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-pink-100 text-2xl" aria-hidden="true">
            {emoji}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mb-7 mt-1.5 text-[15px] text-neutral-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
