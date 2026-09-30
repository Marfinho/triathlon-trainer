import type { ReactNode } from "react";
import AppShell from "@/components/navigation/AppShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell adminOnly>{children}</AppShell>;
}
