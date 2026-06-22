import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { importActivitiesFromIntervals } from "@/integrations/intervals/importActivities";
import { createIntervalsClientForUser } from "@/integrations/intervals/userClient";

/**
 * POST /api/intervals-activities  – holt Ist-Aktivitäten aus Intervals.icu
 * (Apple/Withings/Strava-Aggregat) nach LocalHub. Idempotent (upsert).
 * Body (optional): { sinceDays?: number }
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const client = await createIntervalsClientForUser(userId);
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error: "Intervals.icu ist nicht konfiguriert.",
      },
      { status: 400 },
    );
  }

  let sinceDays = 60;
  try {
    const body = await request.json();
    if (typeof body?.sinceDays === "number" && Number.isFinite(body.sinceDays) && body.sinceDays > 0) {
      sinceDays = Math.min(Math.round(body.sinceDays), 3650);
    }
  } catch {
    /* leerer Body ok */
  }

  try {
    const result = await importActivitiesFromIntervals({
      db: prisma,
      client,
      userId,
      sinceDays,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Import fehlgeschlagen." },
      { status: 502 },
    );
  }
}
