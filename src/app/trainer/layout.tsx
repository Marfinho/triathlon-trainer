import type { ReactNode } from "react";
import AppShell from "@/components/navigation/AppShell";

export default function TrainerLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
