import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthFrame from "@/components/marketing/AuthFrame";
import DevicePairing from "@/components/device/DevicePairing";
import { listDeviceTokens } from "@/lib/device/flow";

export const dynamic = "force-dynamic";

/**
 * Freigabeseite für die Geräte-Kopplung (RFC 8628, verification_uri).
 * Der Fernseher zeigt einen QR-Code auf /device?code=XXXX-XXXX bzw. den Code
 * zum Abtippen. Login-pflichtig.
 */
export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.slice(0, 20) : "";
  const session = await auth();
  if (!session?.user?.id) {
    const back = code ? `/device?code=${encodeURIComponent(code)}` : "/device";
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(back)}`);
  }
  const devices = await listDeviceTokens(session.user.id);
  return (
    <AuthFrame emoji="📺" title="Fernseher koppeln" subtitle="Gib den Code ein, den die Brick-TV-App anzeigt.">
      <DevicePairing
        initialCode={code}
        devices={devices.map((d) => ({
          id: d.id,
          name: d.name,
          createdAt: d.createdAt.toISOString(),
          lastUsedAt: d.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </AuthFrame>
  );
}
