import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { getEffectiveLimits } from "@/lib/plan-config";
import { getIntegrationRuntime } from "@/lib/integration-config";
import { encryptApiKey } from "@/lib/crypto";

/**
 * PUT    /api/integrations/intervals – verbindet/aktualisiert die Intervals.icu-
 *        Integration. Body: { athleteId, apiKey }. apiKey wird verschlüsselt
 *        gespeichert und nie wieder im Klartext ausgegeben.
 * DELETE /api/integrations/intervals – trennt die Integration (deaktiviert sie).
 */
export async function PUT(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!athleteId || !apiKey) {
    return NextResponse.json(
      { ok: false, error: "athleteId und apiKey sind erforderlich." },
      { status: 400 },
    );
  }

  // Gate: Intervals.icu muss vom Admin aktiviert sein.
  if (!(await getIntegrationRuntime("intervals")).enabled) {
    return NextResponse.json({ ok: false, error: "NOT_CONFIGURED" }, { status: 403 });
  }

  const existing = await prisma.userIntegration.findFirst({
    where: { userId, provider: "intervals" },
  });

  if (!existing || !existing.enabled) {
    // HARD-GATE: maximale Anzahl aktiver Integrationen je Tier.
    const limit = (await getEffectiveLimits(user.plan)).maxActiveIntegrations;
    if (Number.isFinite(limit)) {
      const current = await prisma.userIntegration.count({
        where: { userId, enabled: true },
      });
      if (current >= limit) {
        return NextResponse.json(
          { error: "LIMIT_REACHED", limit, current, tier: user.plan },
          { status: 403 },
        );
      }
    }
  }

  const encrypted = encryptApiKey(apiKey);
  await prisma.userIntegration.upsert({
    where: { userId_provider: { userId, provider: "intervals" } },
    create: { userId, provider: "intervals", apiKey: encrypted, athleteId, enabled: true },
    update: { apiKey: encrypted, athleteId, enabled: true },
  });

  return NextResponse.json({ ok: true, athleteId, connected: true });
}

export async function DELETE() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  await prisma.userIntegration.updateMany({
    where: { userId, provider: "intervals" },
    data: { enabled: false },
  });

  return NextResponse.json({ ok: true, connected: false });
}
