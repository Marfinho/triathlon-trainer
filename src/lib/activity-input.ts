/**
 * Validierung eines Aktivitäts-Uploads (Radrolle im Browser oder brick-tv).
 * Gemeinsam genutzt von POST /api/activities und POST /api/tv/activities.
 */

/** Aufzeichnungs-Samples: nur Arrays, gedeckelt (Speicher-/DoS-Schutz). */
export const MAX_ACTIVITY_SAMPLES = 50000;

export interface ActivityInput {
  sport: string;
  date: Date;
  durationMin: number;
  distanceKm: number | null;
  load: number | null;
  rpe: number | null;
  avgHr: number | null;
  avgPower: number | null;
  notes: string | null;
  source: string | null;
  rawJson: object | undefined;
}

// Nur endliche Zahlen akzeptieren (NaN/Infinity bestehen `typeof === "number"`).
const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function parseActivityInput(
  raw: unknown,
): { ok: true; input: ActivityInput } | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Ungültiger Body." };
  }
  const body = raw as Record<string, unknown>;
  const sport = typeof body.sport === "string" ? body.sport.slice(0, 40) : "bike";
  const durationMin = finite(body.durationMin);
  if (durationMin == null || durationMin <= 0) {
    return { ok: false, error: "durationMin fehlt oder ist ungültig." };
  }

  // Datum validieren – ungültige Eingaben fallen auf "jetzt" zurück statt 500.
  let date = new Date();
  if (typeof body.date === "string") {
    const parsed = new Date(body.date);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  return {
    ok: true,
    input: {
      sport,
      date,
      durationMin,
      distanceKm: finite(body.distanceKm),
      load: finite(body.load),
      rpe: finite(body.rpe),
      avgHr: finite(body.avgHr),
      avgPower: finite(body.avgPower),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
      source: typeof body.source === "string" ? body.source.slice(0, 40) : null,
      rawJson: Array.isArray(body.samples)
        ? (body.samples.slice(0, MAX_ACTIVITY_SAMPLES) as object)
        : undefined,
    },
  };
}

/** Prisma-Daten für `actualActivity.create`. */
export function activityCreateData(
  userId: string,
  input: ActivityInput,
  opts: { source: string; externalId?: string | null },
) {
  return {
    userId,
    source: opts.source,
    externalId: opts.externalId ?? null,
    date: input.date,
    sport: input.sport,
    durationMin: input.durationMin,
    distanceKm: input.distanceKm,
    distanceM: input.distanceKm != null ? Math.round(input.distanceKm * 1000) : null,
    load: input.load,
    rpe: input.rpe,
    // Prisma-Spalten sind Int: gerundet speichern.
    avgHr: input.avgHr != null ? Math.round(input.avgHr) : null,
    avgPower: input.avgPower != null ? Math.round(input.avgPower) : null,
    notes: input.notes,
    rawJson: input.rawJson,
  };
}
