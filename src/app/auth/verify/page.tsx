"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthFrame from "@/components/marketing/AuthFrame";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => setState(r.ok ? "ok" : "error"))
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="flex flex-col gap-4 text-[15px] text-neutral-700">
      {state === "loading" && <p>Bestätige deine E-Mail-Adresse…</p>}
      {state === "ok" && <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">E-Mail bestätigt – dein Konto ist aktiv.</p>}
      {state === "error" && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 font-medium text-rose-700">Der Link ist ungültig oder abgelaufen. Melde dich an, um eine neue Bestätigungsmail anzufordern.</p>}
      <Link href="/auth/login" className="btn-pop w-full px-4 py-3 text-center">Zur Anmeldung</Link>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AuthFrame emoji="✉️" title="E-Mail bestätigen" subtitle="Nur noch ein Schritt bis zu deinem Training.">
      <Suspense fallback={null}><Verify /></Suspense>
    </AuthFrame>
  );
}
