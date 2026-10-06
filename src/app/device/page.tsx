import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthFrame from "@/components/marketing/AuthFrame";
import DeviceForm from "@/components/device/DeviceForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brick – Gerät koppeln" };

/**
 * Gerät koppeln (RFC 8628 Verification-URI): Hier gibt der Nutzer den Code ein, den
 * der Fernseher anzeigt (oder landet per QR mit `?code=`). Login-pflichtig.
 */
export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.slice(0, 12) : "";

  const session = await auth();
  if (!session?.user?.id) {
    const back = `/device${code ? `?code=${encodeURIComponent(code)}` : ""}`;
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(back)}`);
  }

  return (
    <AuthFrame emoji="📺" title="Gerät koppeln" subtitle="Gib den Code ein, den dein Fernseher anzeigt.">
      <DeviceForm initialCode={code} />
    </AuthFrame>
  );
}
