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
          className="text-sm font-semibold text-neutral-700"
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
          className="w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="login-password"
          className="text-sm font-semibold text-neutral-700"
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
          className="w-full border border-neutral-200 px-4 py-3 text-neutral-900 outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-pop mt-1 w-full px-4 py-3"
      >
        {loading ? "Anmelden…" : "Anmelden"}
      </button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs font-medium text-neutral-400">oder</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { redirectTo: "/dashboard" })}
        className="btn-soft w-full px-4 py-3"
      >
        Mit Google
      </button>

      {showRegisterLink && (
        <p className="pt-1 text-center text-sm text-neutral-500">
          Noch kein Konto?{" "}
          <Link href="/auth/register" className="font-semibold text-blue-600 hover:underline">
            Registrieren
          </Link>
        </p>
      )}
    </form>
  );
}
