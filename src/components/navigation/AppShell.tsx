import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/components/navigation/Sidebar";
import BottomNav from "@/components/navigation/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Gemeinsames Seitengerüst aller eingeloggten Bereiche: Sidebar (Desktop),
 * Bottom-Navigation (Mobil) und Toasts. `adminOnly` leitet Nicht-Admins um.
 */
export default async function AppShell({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (adminOnly && session.user.role !== "admin") redirect("/dashboard");

  return (
    <ToastProvider>
      <div className="app-shell flex min-h-screen flex-col md:flex-row">
        <Sidebar session={session} />
        <main className="min-w-0 flex-1 md:ml-[16.5rem]">
          <div className="pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-6">{children}</div>
        </main>
        <BottomNav session={session} />
      </div>
    </ToastProvider>
  );
}
