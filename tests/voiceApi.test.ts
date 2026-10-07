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

import { authenticateDeviceToken, createDeviceToken, listDeviceTokens } from "@/lib/device/pairing";
import { hashToken } from "@/lib/mcp/token";
import { isoDateInZone } from "@/lib/voice/summary";
import { parseIsoDate, addDays, formatIsoDate } from "@/domain/training/dates";
import { GET as summaryGet } from "@/app/api/voice/v1/summary/route";
import { GET as tokensGet, POST as tokensPost } from "@/app/api/device/tokens/route";
import { POST as codePost } from "@/app/api/device/code/route";
import { GET as tvTodayGet } from "@/app/api/tv/v1/today/route";
import { GET as tvWeekGet } from "@/app/api/tv/v1/week/route";
import { GET as liveGet } from "@/app/api/live/route";

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
  await db.deviceCode.deleteMany();
  await db.rateLimitEntry.deleteMany();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ user: { id: userId } });
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const summaryReq = (qs = "", headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/voice/v1/summary${qs}`, { headers });
const postTokens = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/device/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const voiceToken = async (uid = userId) => (await createDeviceToken({ userId: uid, name: "HA", scopes: ["voice"] })).token;
const tvToken = async (uid = userId) => (await createDeviceToken({ userId: uid, name: "TV" })).token;

describe("Scope-Trennung tv / voice", () => {
  it("Standard bleibt tv, voice nur auf Wunsch; ungültige Scopes werden abgelehnt", async () => {
    const tv = await createDeviceToken({ userId, name: "TV" });
    expect(tv.scopes).toEqual(["tv"]);
    const v = await createDeviceToken({ userId, name: "HA", scopes: ["voice"] });
    expect(v.scopes).toEqual(["voice"]);
    expect((await authenticateDeviceToken(v.token))?.scopes).toEqual(["voice"]);
    await expect(
      createDeviceToken({ userId, name: "x", scopes: ["admin" as never] }),
    ).rejects.toThrow();
  });

  it("voice-Token darf nicht auf /api/tv/* und /api/live", async () => {
    const token = await voiceToken();
    mockAuth.mockResolvedValue(null);
    for (const call of [
      () => tvTodayGet(new Request("http://localhost/api/tv/v1/today", { headers: bearer(token) })),
      () => tvWeekGet(new Request("http://localhost/api/tv/v1/week", { headers: bearer(token) })),
      () => liveGet(new Request("http://localhost/api/live", { headers: bearer(token) })),
    ]) {
      expect((await call()).status).toBe(401);
    }
  });

  it("tv-Token darf nicht auf /api/voice/*", async () => {
    const token = await tvToken();
    mockAuth.mockResolvedValue(null);
    const res = await summaryGet(summaryReq("", bearer(token)));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("voice-Token ist kein Session-Ersatz für die Token-Verwaltung", async () => {
    const token = await voiceToken();
    mockAuth.mockResolvedValue(null);
    expect((await tokensGet()).status).toBe(401);
    expect((await tokensPost(postTokens({ name: "x", scope: "voice" }, bearer(token)))).status).toBe(401);
  });
});

describe("Token-Verwaltung", () => {
  it("POST erzeugt ein voice-Token und zeigt den Klartext nur einmal", async () => {
    const res = await tokensPost(postTokens({ name: "Home Assistant", scope: "voice" }));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = await res.json();
    expect(data.token.startsWith("lht_")).toBe(true);
    expect(data.scopes).toEqual(["voice"]);

    // In der DB nur der Hash, Liste und Folgeabrufe ohne Klartext.
    const row = await db.deviceToken.findFirstOrThrow({ where: { userId } });
    expect(row.tokenHash).toBe(hashToken(data.token));
    expect(JSON.stringify(row)).not.toContain(data.token);
    const list = await (await tokensGet()).json();
    expect(JSON.stringify(list)).not.toContain(data.token);
    expect(list.devices[0]).toMatchObject({ name: "Home Assistant", scopes: ["voice"] });
    expect(list.devices[0].token).toBeUndefined();
    expect((await listDeviceTokens(userId))[0].scopes).toEqual(["voice"]);
  });

  it("lehnt andere Scopes, fehlende Session und Bearer-Header ab", async () => {
    expect((await tokensPost(postTokens({ name: "x", scope: "tv" }))).status).toBe(400);
    expect((await tokensPost(postTokens({ name: "x" }))).status).toBe(400);
    expect((await tokensPost(postTokens({ name: "x", scope: "voice" }, bearer("lht_abc")))).status).toBe(403);
    mockAuth.mockResolvedValue(null);
    expect((await tokensPost(postTokens({ name: "x", scope: "voice" }))).status).toBe(401);
    expect(await db.deviceToken.count()).toBe(0);
  });

  it("voice-Token kommt nicht über den Device-Code-Flow", async () => {
    const res = await codePost(
      new Request("http://localhost/api/device/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: "x", scope: "voice" }),
      }),
    );
    expect(res.status).toBe(200);
    const row = await db.deviceCode.findFirstOrThrow();
    expect(JSON.stringify(row)).not.toContain("voice");
  });
});

describe("GET /api/voice/v1/summary", () => {
  const todayIso = () => isoDateInZone(new Date());
  const seed = async (uid: string, offsetDays: number, over: Record<string, unknown> = {}) =>
    db.plannedWorkout.create({
      data: {
        userId: uid,
        date: addDays(parseIsoDate(todayIso()), offsetDays),
        sport: "bike",
        title: "Grundlagen (Z2) #1",
        plannedDurationMin: 80,
        ...over,
      },
    });

  it("liefert Text und Items per Bearer, ohne IDs/Token, no-store", async () => {
    await seed(userId, 0);
    const token = await voiceToken();
    mockAuth.mockResolvedValue(null);
    const res = await summaryGet(summaryReq("?day=today&detail=short", bearer(token)));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = await res.json();
    expect(data.text).toBe("Heute steht Radfahren für 1 Stunde 20 auf dem Plan.");
    expect(data.items).toEqual([
      { sport: "bike", title: "Grundlagen Z2 1", durationMin: 80, status: "planned", date: todayIso() },
    ]);
    const raw = JSON.stringify(data);
    expect(raw).not.toContain(token);
    expect(raw).not.toContain(userId);
    expect(Object.keys(data).sort()).toEqual(["items", "text"]);
  });

  it("Session ohne Header funktioniert ebenfalls; Standard ist today/short", async () => {
    await seed(userId, 0);
    const res = await summaryGet(summaryReq());
    expect(res.status).toBe(200);
    expect((await res.json()).text).toContain("Radfahren");
  });

  it("morgen, Woche, erledigt und ignorierte Status", async () => {
    await seed(userId, 1, { sport: "run", plannedDurationMin: 45 });
    await seed(userId, 2, { sport: "swim", plannedDurationMin: 30, status: "skipped" });
    await seed(userId, 0, { sport: "strength", plannedDurationMin: 20, status: "completed" });
    const tomorrow = await (await summaryGet(summaryReq("?day=tomorrow"))).json();
    expect(tomorrow.text).toBe("Morgen steht Laufen für 45 Minuten auf dem Plan.");
    const week = await (await summaryGet(summaryReq("?day=week"))).json();
    expect(week.text).toContain("Deine nächsten sieben Tage.");
    expect(week.text).toContain("Heute Krafttraining erledigt.");
    expect(week.text).toContain("Morgen Laufen für 45 Minuten.");
    expect(week.text).not.toContain("Schwimmen");
    const today = await (await summaryGet(summaryReq("?day=today"))).json();
    expect(today.text).toBe("Das Krafttraining hast du schon gemacht.");
  });

  it("zählt eine passende Aktivität als erledigt", async () => {
    await seed(userId, 0);
    await db.actualActivity.create({
      data: { userId, date: new Date(), sport: "bike", durationMin: 62, source: "manual" },
    });
    const data = await (await summaryGet(summaryReq())).json();
    expect(data.text).toBe("Das Radtraining hast du schon gemacht.");
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({ status: "done", durationMin: 62 });
  });

  it("detail=normal ergänzt Form und Wettkampf, nie Schmerzdaten", async () => {
    await db.raceEvent.create({
      data: { userId, name: "Testrennen (Sprint)", date: addDays(parseIsoDate(todayIso()), 30), type: "triathlon", distance: "sprint", priority: "A" },
    });
    await db.painSnapshot.create({ data: { userId, date: new Date(), overall: 8, knee: 8, notes: "Knie stark" } });
    await db.readinessSnapshot.create({ data: { userId, date: new Date(), status: "red", notes: "Schmerz Knie" } });
    const data = await (await summaryGet(summaryReq("?detail=normal"))).json();
    expect(data.text).toContain("Bis zu deinem Wettkampf Testrennen Sprint sind es noch ungefähr 4 Wochen.");
    expect(data.text).toMatch(/erholt|Form|ermüdet|Belastung/);
    expect(data.text).not.toMatch(/Knie|Schmerz/i);
    const short = await (await summaryGet(summaryReq("?detail=short"))).json();
    expect(short.text).toBe("Heute ist nichts geplant.");
  });

  it("sieht keine Daten anderer Nutzer", async () => {
    const other = await db.user.create({ data: { email: `other-${Date.now()}@example.com` } });
    await seed(other.id, 0, { sport: "run", title: "Geheim" });
    const token = await voiceToken();
    mockAuth.mockResolvedValue(null);
    const data = await (await summaryGet(summaryReq("?day=week", bearer(token)))).json();
    expect(data.items).toEqual([]);
    expect(JSON.stringify(data)).not.toMatch(/Geheim|Laufen/);
    // Token des anderen Nutzers sieht nur dessen Daten.
    const otherToken = await voiceToken(other.id);
    const theirs = await (await summaryGet(summaryReq("", bearer(otherToken)))).json();
    expect(theirs.items[0].sport).toBe("run");
  });

  it("validiert Parameter", async () => {
    expect((await summaryGet(summaryReq("?day=yesterday"))).status).toBe(400);
    expect((await summaryGet(summaryReq("?detail=long"))).status).toBe(400);
  });

  it("Auth-Fehler: ohne Session, ungültiges/widerrufenes Token, MCP-Token", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await summaryGet(summaryReq())).status).toBe(401);
    expect((await summaryGet(summaryReq("", bearer("lht_gibtsnicht")))).status).toBe(401);
    expect((await summaryGet(summaryReq("", bearer("lhm_irgendwas")))).status).toBe(401);
    expect((await summaryGet(summaryReq("", { Authorization: "Basic abc" }))).status).toBe(401);
    const token = await voiceToken();
    expect((await summaryGet(summaryReq("", bearer(token)))).status).toBe(200);
    await db.deviceToken.updateMany({ data: { revokedAt: new Date() } });
    expect((await summaryGet(summaryReq("", bearer(token)))).status).toBe(401);
    // Auch bei gültiger Session: ein ungültiger Bearer fällt nicht auf die Session zurück.
    mockAuth.mockResolvedValue({ user: { id: userId } });
    expect((await summaryGet(summaryReq("", bearer("lht_ungueltig")))).status).toBe(401);
  });

  it("Rate-Limit je Token (30/min) mit Retry-After; anderes Token unberührt", async () => {
    const token = await voiceToken();
    const other = await voiceToken();
    mockAuth.mockResolvedValue(null);
    for (let i = 0; i < 30; i++) {
      expect((await summaryGet(summaryReq("", bearer(token)))).status).toBe(200);
    }
    const limited = await summaryGet(summaryReq("", bearer(token)));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect((await summaryGet(summaryReq("", bearer(other)))).status).toBe(200);
  });

  it("Rate-Limit für wiederholte Auth-Fehler je IP", async () => {
    mockAuth.mockResolvedValue(null);
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await summaryGet(summaryReq("", bearer(`lht_falsch${i}`)))).status;
    }
    expect(last).toBe(429);
  });
});

describe("Tageswechsel um Mitternacht", () => {
  it("loadVoiceSummary nutzt den lokalen Tag (Berlin), nicht UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // 23:30 UTC am 6.10. = 01:30 Berlin am 7.10.
      vi.setSystemTime(new Date("2026-10-06T23:30:00Z"));
      await db.plannedWorkout.createMany({
        data: [
          { userId, date: parseIsoDate("2026-10-06"), sport: "run", title: "Gestern", plannedDurationMin: 30 },
          { userId, date: parseIsoDate("2026-10-07"), sport: "bike", title: "Heute", plannedDurationMin: 60 },
        ],
      });
      const data = await (await summaryGet(summaryReq("?day=today"))).json();
      expect(data.text).toBe("Heute steht Radfahren für 1 Stunde auf dem Plan.");
      expect(data.items[0].date).toBe(formatIsoDate(parseIsoDate("2026-10-07")));
    } finally {
      vi.useRealTimers();
    }
  });
});
