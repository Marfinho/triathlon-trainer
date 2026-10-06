import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import AuthFrame from "@/components/marketing/AuthFrame";
import ConsentForm from "@/components/oauth/ConsentForm";
import { OAuthError, baseUrl, validateAuthorizeRequest } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const PARAM_KEYS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "resource",
  "scope",
] as const;

/**
 * Zustimmungsseite des OAuth-Flows (claude.ai → LocalHub). Login-pflichtig
 * (Middleware); die Anfrage wird hier wie später beim Absenden vollständig
 * validiert. Bei ungültigen Anfragen wird NIE zum Client weitergeleitet.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params: Record<string, string> = {};
  for (const k of PARAM_KEYS) {
    const v = sp[k];
    if (typeof v === "string") params[k] = v;
  }

  const session = await auth();
  if (!session?.user?.id) {
    const back = `/oauth/authorize?${new URLSearchParams(params).toString()}`;
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(back)}`);
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = baseUrl(new Request(`${proto}://${h.get("host") ?? "localhost"}/`));

  try {
    const req = await validateAuthorizeRequest(params, base, prisma);
    return (
      <AuthFrame emoji="🔗" title="Verbindung erlauben" subtitle="Ein externer Dienst fragt Zugriff auf deine Trainingsdaten an.">
        <ConsentForm
          clientName={req.client.clientName}
          redirectHost={new URL(req.redirectUri).host}
          params={params}
        />
      </AuthFrame>
    );
  } catch (e) {
    const message = e instanceof OAuthError ? e.message : "Unbekannter Fehler.";
    return (
      <AuthFrame emoji="⚠️" title="Anfrage ungültig" subtitle={message}>
        <p className="text-sm text-neutral-500">Es wurde nichts freigegeben. Du kannst dieses Fenster schließen.</p>
      </AuthFrame>
    );
  }
}
