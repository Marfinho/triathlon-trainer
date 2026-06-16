"use client";

import Link from "next/link";
import LoginForm from "@/components/marketing/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1120] px-4 py-12 text-[#F8FAFC]">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="font-display text-2xl font-medium">LocalHub</span>
          <span className="h-2 w-2 rounded-full bg-[#F0A500]" />
        </Link>

        <div className="rounded-2xl border border-[#1E293B] bg-[#111827] p-6 shadow-2xl sm:p-8">
          <h1 className="mb-1 text-2xl font-semibold">Anmelden</h1>
          <p className="mb-6 text-sm text-[#94A3B8]">
            Willkommen zurück bei deinem Trainings-Hub.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
