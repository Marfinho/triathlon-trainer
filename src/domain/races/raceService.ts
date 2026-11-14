import type { PrismaClient, RaceEvent } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { getEffectiveLimits } from "@/lib/plan-config";
import { geocodeLocation, type GeocodeResult } from "@/integrations/weather/openMeteo";
import { sanitizeOptionalText, sanitizeText } from "@/domain/security/sanitize";

/**
 * Anlegen/Ändern von Rennen für einen Nutzer. Gemeinsame Basis der REST-Route
 * (/api/races) und des MCP-Servers, damit beide dieselben Regeln anwenden:
 * Plan-Limit, Text-Härtung und optionales Geocoding des Ortes (fail-soft).
 */

export const RACE_TYPES = ["triathlon", "run", "bike", "swim"] as const;
export const RACE_PRIORITIES = ["A", "B", "C"] as const;

export interface RaceDeps {
  db?: PrismaClient;
  /** Überschreibbar für Tests; Standard: Open-Meteo. */
  geocode?: (name: string) => Promise<GeocodeResult | null>;
  /** Überschreibbar für Tests; Standard: effektives Plan-Limit (inkl. Admin-Overrides). */
  maxRaces?: (plan: string) => Promise<number>;
}

export interface RaceInput {
  name?: unknown;
  /** YYYY-MM-DD (bzw. ISO-Zeitstempel, nur die ersten 10 Zeichen zählen). */
  date?: unknown;
  type?: unknown;
  distance?: unknown;
  priority?: unknown;
  notes?: unknown;
  locationName?: unknown;
}

export type RaceResult =
  | { ok: true; race: RaceEvent }
  | { ok: false; error: "INVALID"; message: string }
  | { ok: false; error: "NOT_FOUND" }
  | { ok: false; error: "LIMIT_REACHED"; limit: number; current: number; tier: string };

/** Wirksamer Plan eines Nutzers; ein abgelaufenes "paid" gilt wie in requireUser() als "free". */
export async function effectivePlan(userId: string, db: PrismaClient = defaultPrisma): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } });
  const plan = u?.plan ?? "free";
  if (plan === "paid" && u?.planExpiresAt && u.planExpiresAt.getTime() < Date.now()) return "free";
  return plan;
}

export function parseRaceDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ort auflösen; schlägt das Geocoding fehl, bleibt der Ort als Text erhalten. */
async function resolveLocation(
  raw: unknown,
  geocode: NonNullable<RaceDeps["geocode"]>,
): Promise<{ locationName: string | null; lat: number | null; lon: number | null }> {
  let locationName = sanitizeOptionalText(raw, 120);
  let lat: number | null = null;
  let lon: number | null = null;
  if (locationName) {
    try {
      const geo = await geocode(locationName);
      if (geo) {
        lat = geo.lat;
        lon = geo.lon;
        locationName = geo.displayName;
      }
    } catch {
      // Geocoding ist optional; Ort bleibt Text und wird später erneut aufgelöst.
    }
  }
  return { locationName, lat, lon };
}

export async function createRaceForUser(
  userId: string,
  plan: string,
  input: RaceInput,
  deps: RaceDeps = {},
): Promise<RaceResult> {
  const db = deps.db ?? defaultPrisma;

  const name = sanitizeText(input.name, 200);
  const raceDate = parseRaceDate(input.date);
  if (!name || typeof input.date !== "string" || !input.date) {
    return { ok: false, error: "INVALID", message: "Name und Datum sind erforderlich." };
  }
  if (!raceDate) return { ok: false, error: "INVALID", message: "Ungültiges Datum." };

  const limit = await (deps.maxRaces ?? (async (p) => (await getEffectiveLimits(p)).maxRaceEvents))(plan);
  if (Number.isFinite(limit)) {
    const current = await db.raceEvent.count({ where: { userId } });
    if (current >= limit) return { ok: false, error: "LIMIT_REACHED", limit, current, tier: plan };
  }

  const loc = await resolveLocation(input.locationName, deps.geocode ?? geocodeLocation);
  const race = await db.raceEvent.create({
    data: {
      userId,
      name,
      date: raceDate,
      type: typeof input.type === "string" ? input.type : "triathlon",
      distance: sanitizeOptionalText(input.distance, 60),
      priority: typeof input.priority === "string" ? input.priority : "B",
      notes: sanitizeOptionalText(input.notes, 2000),
      ...loc,
    },
  });
  return { ok: true, race };
}

export interface RaceUpdate extends RaceInput {
  completed?: unknown;
  resultSeconds?: unknown;
  resultPlacement?: unknown;
  resultNote?: unknown;
}

const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Ändert ein Rennen des Nutzers (nur vorhandene Felder). Fremde IDs → NOT_FOUND. */
export async function updateRaceForUser(
  userId: string,
  id: string,
  input: RaceUpdate,
  deps: RaceDeps = {},
): Promise<RaceResult> {
  const db = deps.db ?? defaultPrisma;
  const existing = await db.raceEvent.findFirst({ where: { id, userId } });
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  const data: Record<string, unknown> = {};
  if ("name" in input) {
    const name = sanitizeText(input.name, 200);
    if (!name) return { ok: false, error: "INVALID", message: "Name darf nicht leer sein." };
    data.name = name;
  }
  if ("date" in input) {
    const d = parseRaceDate(input.date);
    if (!d) return { ok: false, error: "INVALID", message: "Ungültiges Datum." };
    data.date = d;
  }
  if (typeof input.type === "string") data.type = input.type;
  if (typeof input.priority === "string") data.priority = input.priority;
  if ("distance" in input) data.distance = sanitizeOptionalText(input.distance, 60);
  if ("notes" in input) data.notes = sanitizeOptionalText(input.notes, 2000);
  if (typeof input.completed === "boolean") data.completed = input.completed;
  if (input.resultSeconds === null) data.resultSeconds = null;
  else if (finite(input.resultSeconds) != null) data.resultSeconds = Math.round(input.resultSeconds as number);
  if (finite(input.resultPlacement) != null) data.resultPlacement = Math.round(input.resultPlacement as number);
  if (typeof input.resultNote === "string") data.resultNote = input.resultNote.slice(0, 2000);

  if ("locationName" in input) {
    Object.assign(data, await resolveLocation(input.locationName, deps.geocode ?? geocodeLocation));
  }

  const race = await db.raceEvent.update({ where: { id }, data }).catch(() => null);
  return race ? { ok: true, race } : { ok: false, error: "NOT_FOUND" };
}
