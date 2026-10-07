import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { addDays, formatIsoDate, parseIsoDate } from "@/domain/training/dates";
import { activityName, isoDateInZone, sanitizeSpeech } from "@/lib/voice/summary";
import { buildIcs, type IcsEvent } from "./ics";

const PAST_DAYS = 14;
const FUTURE_DAYS = 120;
const INACTIVE_STATUSES = ["skipped", "cancelled", "replaced"];
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 500;

const uidFor = (kind: string, id: string) =>
  `${createHash("sha256").update(`${kind}:${id}`).digest("hex").slice(0, 24)}@brick`;

function durationLabel(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "";
  const m = Math.round(min);
  return m < 60 ? `${m} Min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
}

/** Plan und Wettkämpfe des Nutzers als ICS. Keine Gesundheits- oder Schmerzdaten, keine Roh-IDs. */
export async function buildTrainingIcs(
  userId: string,
  db: PrismaClient = defaultPrisma,
  now: Date = new Date(),
): Promise<string> {
  const today = parseIsoDate(isoDateInZone(now));
  const from = addDays(today, -PAST_DAYS);
  const to = addDays(today, FUTURE_DAYS);
  const [planned, races] = await Promise.all([
    db.plannedWorkout.findMany({
      where: { userId, date: { gte: from, lte: to }, status: { notIn: INACTIVE_STATUSES } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, date: true, sport: true, title: true, plannedDurationMin: true, description: true, status: true },
    }),
    db.raceEvent.findMany({
      where: { userId, completed: false, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, name: true, priority: true },
    }),
  ]);

  const events: IcsEvent[] = [
    ...planned.map((w): IcsEvent => {
      const done = w.status === "completed";
      const title = w.title.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
      const activity = activityName(w.sport);
      const head = [w.sport === "rest" ? "Ruhetag" : activity, durationLabel(w.plannedDurationMin)].filter(Boolean).join(" ");
      const generic = !title || title.toLowerCase() === activity.toLowerCase();
      return {
        uid: uidFor("workout", w.id),
        date: formatIsoDate(w.date),
        summary: `${done ? "Erledigt: " : ""}${head}${generic ? "" : ` - ${title}`}`,
        description: w.description?.trim().slice(0, DESCRIPTION_MAX) || undefined,
        categories: "Training",
      };
    }),
    ...races.map((r): IcsEvent => ({
      uid: uidFor("race", r.id),
      date: formatIsoDate(r.date),
      summary: `Wettkampf: ${sanitizeSpeech(r.name, TITLE_MAX) || "Wettkampf"}`,
      categories: "Wettkampf",
    })),
  ];
  return buildIcs(events, { name: "Brick Training", now });
}
