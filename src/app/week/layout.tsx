import type { ReactNode } from "react";
import AppShell from "@/components/navigation/AppShell";

export default function WeekLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
