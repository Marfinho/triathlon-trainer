import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import {
  getEffectiveLimits,
  defaultLimits,
  setPlanOverride,
  knownTiers,
  toJsonSafeLimits,
  sanitizeOverride,
  type PlanOverrideSettings,
} from "@/lib/plan-config";

/**
 * GET  /api/admin/plan-limits – effektive + Default-Limits je Tier plus
 *      gespeicherte Overrides. JSON-sicher (Infinity -> null).
 * POST /api/admin/plan-limits – { tier, settings } speichert einen Override.
 */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const tiers = knownTiers();
  const overrides = await prisma.planOverride.findMany();
  const overrideByTier = new Map(overrides.map((o) => [o.tier, o]));

  const result = await Promise.all(
    tiers.map(async (tier) => {
      const effective = await getEffectiveLimits(tier);
      const row = overrideByTier.get(tier);
      return {
        tier,
        defaults: toJsonSafeLimits(defaultLimits(tier)),
        effective: toJsonSafeLimits(effective),
        override: (row?.settingsJson as PlanOverrideSettings | undefined) ?? null,
        updatedAt: row?.updatedAt ?? null,
        updatedBy: row?.updatedBy ?? null,
      };
    }),
  );

  return NextResponse.json({ tiers: result });
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

  const tier = typeof body.tier === "string" ? body.tier : "";
  if (!knownTiers().includes(tier as never)) {
    return NextResponse.json(
      { error: "Unbekanntes Tier.", tiers: knownTiers() },
      { status: 400 },
    );
  }

  const settings = sanitizeOverride(
    (body.settings ?? {}) as PlanOverrideSettings,
  );
  const effective = await setPlanOverride(tier, settings, user.userId);

  return NextResponse.json({
    ok: true,
    tier,
    effective: toJsonSafeLimits(effective),
  });
}
