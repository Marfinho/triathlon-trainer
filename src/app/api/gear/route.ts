import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildGearTree } from "@/domain/training/gear";

/**
 * GET  /api/gear  – Geräte als Baum (Komponenten unter Rädern) inkl. Nutzung.
 * POST /api/gear  – neues Gerät / neue Komponente anlegen.
 */
export async function GET() {
  const [items, activities] = await Promise.all([
    prisma.gearItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.actualActivity.findMany({
      select: { date: true, sport: true, distanceKm: true, durationMin: true },
    }),
  ]);

  return NextResponse.json({ gear: buildGearTree(items, activities) });
}

export async function POST(request: Request) {
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

  const num = (v: unknown): number | null =>
    typeof v === "number" && !Number.isNaN(v) ? v : null;

  const created = await prisma.gearItem.create({
    data: {
      name,
      type: typeof body.type === "string" ? body.type : "other",
      sport: typeof body.sport === "string" ? body.sport : null,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      brand: typeof body.brand === "string" ? body.brand : null,
      model: typeof body.model === "string" ? body.model : null,
      purchaseDate:
        typeof body.purchaseDate === "string" && body.purchaseDate
          ? new Date(`${body.purchaseDate.slice(0, 10)}T00:00:00Z`)
          : null,
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
