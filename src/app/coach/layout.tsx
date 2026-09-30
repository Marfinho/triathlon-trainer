import type { ReactNode } from "react";
import AppShell from "@/components/navigation/AppShell";

export default function CoachLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
