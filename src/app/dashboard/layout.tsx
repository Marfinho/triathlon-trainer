import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Dashboard-Layout: stellt den Toast-Provider für alle Dashboard-Komponenten
 * bereit (Client-Provider innerhalb einer Server-Komponente).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
