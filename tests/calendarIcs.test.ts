import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://localhub@localhost:5432/localhub_test";
  return { prisma: new PrismaClient({ datasourceUrl: url }) };
});

import { buildIcs, escapeIcsText, foldIcsLine } from "@/lib/calendar/ics";
import { createDeviceToken } from "@/lib/device/pairing";
import { isoDateInZone } from "@/lib/voice/summary";
import { addDays, parseIsoDate } from "@/domain/training/dates";
import { GET as icsGet } from "@/app/api/calendar/v1/training.ics/route";
import { GET as summaryGet } from "@/app/api/voice/v1/summary/route";
import { GET as tvTodayGet } from "@/app/api/tv/v1/today/route";
import { POST as tokensPost } from "@/app/api/device/tokens/route";

describe("ICS-Kern", () => {
  it("maskiert Text und entfernt Steuerzeichen", () => {
    expect(escapeIcsText("a;b,c\\d\ne\u0007")).toBe("a\;b\\,c\\\\d\\ne");
  });

  it("faltet lange Zeilen auf 75 Oktette, auch mit Umlauten", () => {
    const line = `SUMMARY:${"Übung für Läufer ".repeat(12)}`;
    const folded = foldIcsLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const l of physical) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(physical.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(physical.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(line);
  });

  it("baut einen gültigen, deterministischen Kalender mit ganztägigen Ereignissen", () => {
    const now = new Date("2026-10-07T08:00:00Z");
    const events = [
      { uid: "abc@brick", date: "2026-10-31", summary: "Radfahren 1:20 h - Grundlagen", description: "Locker; 2x10" },
    ];
    const ics = buildIcs(events, { name: "Brick Training", now });
    expect(buildIcs(events, { name: "Brick Training", now })).toBe(ics);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTAMP:20261007T080000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261031");
    expect(ics).toContain("DTEND;VALUE=DATE:20261101"); // Monatswechsel
    expect(ics).toContain("DESCRIPTION:Locker\; 2x10");
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });
});

describe("GET /api/calendar/v1/training.ics", () => {
  let db: PrismaClient;
  let cleanup: () => Promise<void>;
  let userId: string;

  beforeAll(() => {
    const ctx = createTestDb();
    db = ctx.db;
    cleanup = ctx.cleanup;
  });
  afterAll(async () => {
    await cleanup();
  });
  beforeEach(async () => {
    userId = await resetDb(db);
    await db.rateLimitEntry.deleteMany();
    mockAuth.mockReset();
    mockAuth.mockResolvedValue(null);
  });

  const today = () => parseIsoDate(isoDateInZone(new Date()));
  const feed = (qs = "", headers: Record<string, string> = {}) =>
    new Request(`http://localhost/api/calendar/v1/training.ics${qs}`, { headers });
  const token = async (scopes: ("tv" | "voice" | "calendar")[], uid = userId) =>
    (await createDeviceToken({ userId: uid, name: "Kal", scopes })).token;

  it("liefert Plan und Wettkampf als ICS per Query-Token und per Bearer", async () => {
    await db.plannedWorkout.createMany({
      data: [
        { userId, date: today(), sport: "bike", title: "Sweetspot (3x15')", plannedDurationMin: 80, description: "Locker, dann hart" },
        { userId, date: addDays(today(), 1), sport: "run", title: "Laufen", plannedDurationMin: 45, status: "completed" },
        { userId, date: addDays(today(), 2), sport: "swim", title: "Weg", plannedDurationMin: 30, status: "skipped" },
      ],
    });
    await db.raceEvent.create({
      data: { userId, name: "Kraichgau", date: addDays(today(), 30), type: "triathlon", distance: "70.3" },
    });
    const t = await token(["calendar"]);
    for (const res of [await icsGet(feed(`?token=${t}`)), await icsGet(feed("", { Authorization: `Bearer ${t}` }))]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/calendar");
      expect(res.headers.get("cache-control")).toBe("no-store");
      const ics = (await res.text()).replace(/\r\n /g, "");
      expect(ics).toContain("SUMMARY:Radfahren 1:20 h - Sweetspot (3x15')".replace(/[,;]/g, "\\$&"));
      expect(ics).toContain("DESCRIPTION:Locker\\, dann hart");
      expect(ics).toContain("SUMMARY:Erledigt: Laufen 45 Min");
      expect(ics).toContain("SUMMARY:Wettkampf: Kraichgau");
      expect(ics).not.toContain("Weg");
      expect(ics).not.toContain(userId);
      expect(ics).not.toContain(t);
    }
  });

  it("Scope-Trennung: nur calendar-Token öffnet den Feed, calendar-Token nichts anderes", async () => {
    const cal = await token(["calendar"]);
    const voice = await token(["voice"]);
    const tv = await token(["tv"]);
    expect((await icsGet(feed(`?token=${voice}`))).status).toBe(401);
    expect((await icsGet(feed(`?token=${tv}`))).status).toBe(401);
    expect((await icsGet(feed(`?token=${cal}`))).status).toBe(200);
    const bearer = { Authorization: `Bearer ${cal}` };
    expect((await summaryGet(new Request("http://localhost/api/voice/v1/summary", { headers: bearer }))).status).toBe(401);
    expect((await tvTodayGet(new Request("http://localhost/api/tv/v1/today", { headers: bearer }))).status).toBe(401);
  });

  it("Auth-Fehler und Mandantentrennung", async () => {
    expect((await icsGet(feed())).status).toBe(401);
    expect((await icsGet(feed("?token=lht_gibtsnicht"))).status).toBe(401);
    const other = await db.user.create({ data: { email: `o-${Date.now()}@example.com` } });
    await db.plannedWorkout.create({
      data: { userId: other.id, date: today(), sport: "run", title: "Geheim", plannedDurationMin: 30 },
    });
    const t = await token(["calendar"]);
    const ics = await (await icsGet(feed(`?token=${t}`))).text();
    expect(ics).not.toContain("Geheim");
    // Session funktioniert ebenfalls.
    mockAuth.mockResolvedValue({ user: { id: userId } });
    expect((await icsGet(feed())).status).toBe(200);
  });

  it("Rate-Limit je Token (60/min)", async () => {
    const t = await token(["calendar"]);
    for (let i = 0; i < 60; i++) expect((await icsGet(feed(`?token=${t}`))).status).toBe(200);
    const limited = await icsGet(feed(`?token=${t}`));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("cache-control")).toBe("no-store");
  });

  it("Kalender-Token lässt sich nur mit Session erzeugen; tv bleibt verboten", async () => {
    const post = (body: unknown) =>
      tokensPost(
        new Request("http://localhost/api/device/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    expect((await post({ name: "x", scope: "calendar" })).status).toBe(401);
    mockAuth.mockResolvedValue({ user: { id: userId } });
    const res = await post({ name: "Google Kalender", scope: "calendar" });
    expect(res.status).toBe(201);
    expect((await res.json()).scopes).toEqual(["calendar"]);
    expect((await post({ name: "x", scope: "tv" })).status).toBe(400);
  });
});
