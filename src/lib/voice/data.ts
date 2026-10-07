import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { getOverview } from "@/lib/mcp/readers";
import { addDays, formatIsoDate, parseIsoDate } from "@/domain/training/dates";
import {
  buildSpeechText,
  isoDateInZone,
  sanitizeSpeech,
  type VoiceDay,
  type VoiceDayInput,
  type VoiceDetail,
  type VoiceItem,
} from "./summary";

/** Planstatus, die nichts mehr zu tun übrig lassen (nicht vorlesen). */
const INACTIVE_STATUSES = ["skipped", "cancelled", "replaced"];
const TITLE_MAX = 60;

export interface VoiceSummary {
  text: string;
  items: Array<VoiceItem & { date: string }>;
}

/** Tage, die für `day` abgefragt werden (lokale Kalendertage, `today` zuerst). */
export function voiceDates(day: VoiceDay, today: string): string[] {
  const start = parseIsoDate(today);
  if (day === "today") return [today];
  if (day === "tomorrow") return [formatIsoDate(addDays(start, 1))];
  return Array.from({ length: 7 }, (_, i) => formatIsoDate(addDays(start, i)));
}

/**
 * Lädt die Daten für den Sprechtext. Nur Einheiten des übergebenen Nutzers;
 * Ergebnis enthält weder IDs noch Token. „Heute“ ist der Kalendertag in
 * Europe/Berlin – nicht der UTC-Tag (um Mitternacht sonst eine Tagesverschiebung).
 */
export async function loadVoiceSummary(
  userId: string,
  day: VoiceDay,
  detail: VoiceDetail,
  db: PrismaClient = defaultPrisma,
  now: Date = new Date(),
): Promise<VoiceSummary> {
  const today = isoDateInZone(now);
  const dates = voiceDates(day, today);
  const from = parseIsoDate(dates[0]);
  const toExclusive = addDays(parseIsoDate(dates[dates.length - 1]), 1);

  const [planned, actuals] = await Promise.all([
    db.plannedWorkout.findMany({
      where: { userId, date: { gte: from, lt: toExclusive }, status: { notIn: INACTIVE_STATUSES } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { date: true, sport: true, title: true, plannedDurationMin: true, status: true },
    }),
    // Erledigtes gibt es nur bis heute; Puffer für Aktivitäten mit Uhrzeit (UTC vs. lokal).
    dates[0] > today
      ? Promise.resolve([])
      : db.actualActivity.findMany({
          where: { userId, date: { gte: addDays(from, -1), lt: addDays(toExclusive, 1) } },
          orderBy: { date: "asc" },
          select: { date: true, sport: true, durationMin: true },
        }),
  ]);

  const days: VoiceDayInput[] = dates.map((date) => {
    const dayActuals = actuals
      .filter((a) => isoDateInZone(a.date) === date && date <= today)
      .map((a) => ({ sport: a.sport, durationMin: a.durationMin ?? 0, used: false }));
    const items: VoiceItem[] = [];

    for (const w of planned.filter((p) => formatIsoDate(p.date) === date)) {
      const match = dayActuals.find((a) => !a.used && a.sport === w.sport);
      if (match) match.used = true;
      const isDone = w.status === "completed" || Boolean(match);
      items.push({
        sport: w.sport,
        title: sanitizeSpeech(w.title, TITLE_MAX),
        durationMin: isDone && match?.durationMin ? match.durationMin : w.plannedDurationMin,
        status: isDone ? "done" : "planned",
      });
    }
    // Ungeplant Erledigtes zählt ebenfalls („schon gemacht“).
    for (const a of dayActuals.filter((x) => !x.used)) {
      items.push({ sport: a.sport, title: "", durationMin: a.durationMin, status: "done" });
    }
    return { date, items };
  });

  let form: { state: string } | null = null;
  let nextRace: { name: string; daysToRace: number } | null = null;
  if (detail === "normal") {
    const o = await getOverview(db, userId, now);
    form = { state: o.form.formState.state };
    if (o.nextRace?.date) {
      const raceDay = parseIsoDate(o.nextRace.date.slice(0, 10));
      nextRace = {
        name: o.nextRace.name,
        daysToRace: Math.round((raceDay.getTime() - parseIsoDate(today).getTime()) / 86_400_000),
      };
    }
  }

  return {
    text: buildSpeechText({ day, detail, today, days, form, nextRace }),
    items: days.flatMap((d) => d.items.map((i) => ({ ...i, date: d.date }))),
  };
}
