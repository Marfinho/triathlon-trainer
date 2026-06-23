"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

type LoginFormProps = {
  /** Show the "Noch kein Konto?" footer link (hidden inside the inline AuthTabs). */
  showRegisterLink?: boolean;
};

/**
 * Anmeldeformular (E-Mail/Passwort + Google).
 * Wird sowohl auf /auth/login als auch inline in den AuthTabs verwendet.
 */
export default function LoginForm({ showRegisterLink = true }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Bitte Passwort eingeben.");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("E-Mail oder Passwort falsch.");
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("E-Mail oder Passwort falsch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-email"
          className="font-display text-xs uppercase tracking-wider text-[#94A3B8]"
        >
          E-Mail
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="du@example.com"
          className="w-full rounded-lg border border-[#334155] bg-[#0B1120] px-3 py-2.5 text-[#F8FAFC] placeholder:text-[#475569] outline-none transition focus:border-[#F0A500] focus:ring-1 focus:ring-[#F0A500]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-password"
          className="font-display text-xs uppercase tracking-wider text-[#94A3B8]"
        >
          Passwort
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-[#334155] bg-[#0B1120] px-3 py-2.5 text-[#F8FAFC] placeholder:text-[#475569] outline-none transition focus:border-[#F0A500] focus:ring-1 focus:ring-[#F0A500]"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[#F87171]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-[#F0A500] px-4 py-2.5 font-medium text-[#0B1120] transition hover:bg-[#ffb81f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Anmelden…" : "Anmelden"}
      </button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-[#1E293B]" />
        <span className="font-display text-xs text-[#94A3B8]">oder</span>
        <span className="h-px flex-1 bg-[#1E293B]" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: "/dashboard" })}
        className="w-full rounded-lg border border-[#334155] bg-[#111827] px-4 py-2.5 font-medium text-[#F8FAFC] transition hover:border-[#475569]"
      >
        Mit Google
      </button>

      {showRegisterLink && (
        <p className="pt-1 text-center text-sm text-[#94A3B8]">
          Noch kein Konto?{" "}
          <Link href="/auth/register" className="text-[#F0A500] hover:underline">
            Registrieren
          </Link>
        </p>
      )}
    </form>
  );
}
