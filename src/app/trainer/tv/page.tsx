import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TvView } from "@/components/trainer/TvView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brick – TV-Ansicht" };

/** Zweitbildschirm (Apple TV per AirPlay oder Browser): zeigt die laufende Einheit live. */
export default async function TrainerTvPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  return <TvView />;
}
