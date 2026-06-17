import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import {
  listIntegrationConfigViews,
  setIntegrationConfig,
  isKnownProvider,
} from "@/lib/integration-config";

/**
 * GET  /api/admin/integrations – Liste aller Integrationen (Secret maskiert).
 * POST /api/admin/integrations – { provider, enabled?, clientId?, clientSecret?,
 *      clearSecret? } speichert die Konfiguration eines Providers.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const integrations = await listIntegrationConfigViews();
  return NextResponse.json({ integrations });
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const provider = typeof body.provider === "string" ? body.provider : "";
  if (!isKnownProvider(provider)) {
    return NextResponse.json({ error: "Unbekannter Provider." }, { status: 400 });
  }

  const view = await setIntegrationConfig(
    provider,
    {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      clientId: typeof body.clientId === "string" ? body.clientId : undefined,
      clientSecret: typeof body.clientSecret === "string" ? body.clientSecret : undefined,
      clearSecret: body.clearSecret === true,
    },
    user.userId,
  );

  return NextResponse.json({ ok: true, integration: view });
}
