import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildGearTree } from "@/domain/training/gear";
import { requireUser } from "@/lib/auth-guard";
import { getEffectiveLimits } from "@/lib/plan-config";

/**
 * GET  /api/gear  – Geräte als Baum (Komponenten unter Rädern) inkl. Nutzung.
 * POST /api/gear  – neues Gerät / neue Komponente anlegen.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const [items, activities] = await Promise.all([
    prisma.gearItem.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actualActivity.findMany({
      where: { userId },
      select: { date: true, sport: true, distanceKm: true, durationMin: true },
    }),
  ]);

  return NextResponse.json({ gear: buildGearTree(items, activities) });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Name ist erforderlich." },
      { status: 400 },
    );
  }

  const limits = await getEffectiveLimits(user.plan);
  if (typeof body.parentId === "string" && body.parentId) {
    const limit = limits.maxGearComponents;
    if (Number.isFinite(limit)) {
      const current = await prisma.gearItem.count({
        where: { userId, parentId: body.parentId },
      });
      if (current >= limit)
        return NextResponse.json(
          { error: "LIMIT_REACHED", limit, current, tier: user.plan },
          { status: 403 },
        );
    }
  } else {
    const limit = limits.maxGearItems;
    if (Number.isFinite(limit)) {
      const current = await prisma.gearItem.count({
        where: { userId, parentId: null },
      });
      if (current >= limit)
        return NextResponse.json(
          { error: "LIMIT_REACHED", limit, current, tier: user.plan },
          { status: 403 },
        );
    }
  }

  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  // parentId nur akzeptieren, wenn das Elternteil dem Nutzer gehört (kein
  // Querverweis auf fremde Geräte).
  let parentId: string | null = null;
  if (typeof body.parentId === "string" && body.parentId) {
    const parent = await prisma.gearItem.findFirst({
      where: { id: body.parentId, userId },
      select: { id: true },
    });
    parentId = parent?.id ?? null;
  }

  // Kaufdatum validieren – ungültige Eingaben werden ignoriert statt 500.
  let purchaseDate: Date | null = null;
  if (typeof body.purchaseDate === "string" && body.purchaseDate) {
    const parsed = new Date(`${body.purchaseDate.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) purchaseDate = parsed;
  }

  const created = await prisma.gearItem.create({
    data: {
      userId,
      name,
      type: typeof body.type === "string" ? body.type : "other",
      sport: typeof body.sport === "string" ? body.sport : null,
      parentId,
      brand: typeof body.brand === "string" ? body.brand : null,
      model: typeof body.model === "string" ? body.model : null,
      purchaseDate,
      autoTrack: body.autoTrack !== false,
      manualKm: num(body.manualKm) ?? 0,
      manualHours: num(body.manualHours) ?? 0,
      alertKm: num(body.alertKm),
      alertHours: num(body.alertHours),
      notes: typeof body.notes === "string" ? body.notes : null,
    },
  });

  return NextResponse.json({ ok: true, gear: created });
}
