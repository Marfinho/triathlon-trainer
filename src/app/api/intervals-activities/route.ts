import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importActivitiesFromIntervals } from "@/integrations/intervals/importActivities";
import { createIntervalsClientFromEnv } from "@/integrations/intervals/client";

/**
 * POST /api/intervals-activities  – holt Ist-Aktivitäten aus Intervals.icu
 * (Apple/Withings/Strava-Aggregat) nach LocalHub. Idempotent (upsert).
 * Body (optional): { sinceDays?: number }
 */
export async function POST(request: Request) {
  const client = createIntervalsClientFromEnv();
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Intervals.icu ist nicht konfiguriert (INTERVALS_ATHLETE_ID / INTERVALS_API_KEY).",
      },
      { status: 400 },
    );
  }

  let sinceDays = 60;
  try {
    const body = await request.json();
    if (typeof body?.sinceDays === "number") sinceDays = body.sinceDays;
  } catch {
    /* leerer Body ok */
  }

  try {
    const result = await importActivitiesFromIntervals({ db: prisma, client, sinceDays });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Import fehlgeschlagen." },
      { status: 502 },
    );
  }
}
