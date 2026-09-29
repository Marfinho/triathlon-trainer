"use client";

import Link from "next/link";
import LoginForm from "@/components/marketing/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 py-12 text-[#F1F1FB]">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="font-display text-2xl font-medium">LocalHub</span>
          <span className="h-2 w-2 rounded-full bg-[#FF2BD6]" />
        </Link>

        <div className="rounded-2xl border border-[#1C1C2D] bg-[#11111B] p-6 shadow-2xl sm:p-8">
          <h1 className="mb-1 text-2xl font-semibold">Anmelden</h1>
          <p className="mb-6 text-sm text-[#A9A9C4]">
            Willkommen zurück bei deinem Trainings-Hub.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
