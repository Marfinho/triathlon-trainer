import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/components/navigation/Sidebar";
import BottomNav from "@/components/navigation/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-gray-50 md:flex-row">
        {/* Sidebar for desktop */}
        <Sidebar session={session} />

        {/* Main content area */}
        <main className="flex-1 md:ml-60">
          {/* Content */}
          <div className="pb-[80px] md:pb-0">{children}</div>
        </main>

        {/* Bottom nav for mobile */}
        <BottomNav session={session} />
      </div>
    </ToastProvider>
  );
}
