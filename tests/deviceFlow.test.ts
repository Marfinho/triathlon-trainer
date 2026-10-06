import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import {
  authenticateDeviceToken,
  createDeviceAuthorization,
  decideUserCode,
  deviceBearer,
  formatUserCode,
  lookupUserCode,
  normalizeUserCode,
  pollDeviceToken,
  revokeDeviceToken,
  sanitizeClientName,
  DEVICE_CODE_TTL_SEC,
} from "@/lib/device/flow";
import { listTvWorkouts } from "@/lib/device/tvData";
import { parseActivityInput, activityCreateData } from "@/lib/activity-input";

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
  await db.deviceAuthorization.deleteMany();
});

const BASE = "https://brick.example";

describe("user_code", () => {
  it("normalisiert Eingaben und lehnt fremde Zeichen ab", () => {
    expect(normalizeUserCode("bcdf-ghjk")).toBe("BCDFGHJK");
    expect(normalizeUserCode(" BCDF GHJK ")).toBe("BCDFGHJK");
    expect(normalizeUserCode("BCDF-GHJ")).toBeNull(); // zu kurz
    expect(normalizeUserCode("ABCD-EFGH")).toBeNull(); // Vokale nicht im Alphabet
    expect(formatUserCode("BCDFGHJK")).toBe("BCDF-GHJK");
  });

  it("bereinigt den Gerätenamen", () => {
    expect(sanitizeClientName("Fire TV\u0000 Wohnzimmer")).toBe("Fire TV Wohnzimmer");
    expect(sanitizeClientName(undefined)).toBe("Brick TV");
    expect(sanitizeClientName("x".repeat(100))).toHaveLength(60);
  });
});

describe("Device-Flow (RFC 8628)", () => {
  it("koppelt: pending → Freigabe → Token genau einmal", async () => {
    const t0 = new Date("2026-10-07T10:00:00Z");
    const code = await createDeviceAuthorization({ baseUrl: BASE, clientName: "Fire TV", now: t0 }, db);
    expect(code.verification_uri).toBe(`${BASE}/device`);
    expect(code.verification_uri_complete).toBe(`${BASE}/device?code=${code.user_code}`);
    expect(code.expires_in).toBe(DEVICE_CODE_TTL_SEC);
    expect(code.user_code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/);

    const pending = await pollDeviceToken(code.device_code, db, new Date(t0.getTime() + 1000));
    expect(pending).toEqual({ ok: false, error: "authorization_pending" });

    // Zu schnelles Pollen → slow_down
    const fast = await pollDeviceToken(code.device_code, db, new Date(t0.getTime() + 2000));
    expect(fast).toEqual({ ok: false, error: "slow_down" });

    const approved = await decideUserCode(
      { userCode: code.user_code.toLowerCase(), userId, approve: true, now: new Date(t0.getTime() + 3000) },
      db,
    );
    expect(approved).toMatchObject({ ok: true, clientName: "Fire TV" });

    const token = await pollDeviceToken(code.device_code, db, new Date(t0.getTime() + 9000));
    expect(token.ok).toBe(true);
    if (!token.ok) return;
    expect(token.accessToken.startsWith("lht_")).toBe(true);
    expect(token.userId).toBe(userId);

    // Zweites Einlösen schlägt fehl
    const again = await pollDeviceToken(code.device_code, db, new Date(t0.getTime() + 15000));
    expect(again).toEqual({ ok: false, error: "invalid_grant" });

    const principal = await authenticateDeviceToken(token.accessToken, db);
    expect(principal).toMatchObject({ userId, name: "Fire TV" });

    // Der user_code ist verbraucht
    expect(await lookupUserCode(code.user_code, db, new Date(t0.getTime() + 20000))).toEqual({ ok: false, reason: "used" });
  });

  it("liefert access_denied nach Ablehnung", async () => {
    const code = await createDeviceAuthorization({ baseUrl: BASE, clientName: "TV" }, db);
    await decideUserCode({ userCode: code.user_code, userId, approve: false }, db);
    expect(await pollDeviceToken(code.device_code, db)).toEqual({ ok: false, error: "access_denied" });
  });

  it("liefert expired_token nach Ablauf; Freigabe ist dann nicht mehr möglich", async () => {
    const t0 = new Date("2026-10-07T10:00:00Z");
    const code = await createDeviceAuthorization({ baseUrl: BASE, clientName: "TV", now: t0 }, db);
    const later = new Date(t0.getTime() + (DEVICE_CODE_TTL_SEC + 1) * 1000);
    expect(await pollDeviceToken(code.device_code, db, later)).toEqual({ ok: false, error: "expired_token" });
    expect(await decideUserCode({ userCode: code.user_code, userId, approve: true, now: later }, db)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("unbekannte Codes", async () => {
    expect(await pollDeviceToken("nope", db)).toEqual({ ok: false, error: "invalid_grant" });
    expect(await lookupUserCode("BCDF-GHJK", db)).toEqual({ ok: false, reason: "invalid" });
    expect(await lookupUserCode("xx", db)).toEqual({ ok: false, reason: "invalid" });
  });

  it("Widerruf macht das Token ungültig (Gerät bekommt 401)", async () => {
    const code = await createDeviceAuthorization({ baseUrl: BASE, clientName: "TV" }, db);
    await decideUserCode({ userCode: code.user_code, userId, approve: true }, db);
    const token = await pollDeviceToken(code.device_code, db);
    if (!token.ok) throw new Error("kein Token");
    const otherUser = await db.user.create({ data: { email: `x-${Date.now()}@example.com` } });
    // Fremde Nutzer können nicht widerrufen
    expect(await revokeDeviceToken(token.tokenId, otherUser.id, db)).toBe(false);
    expect(await revokeDeviceToken(token.tokenId, userId, db)).toBe(true);
    expect(await authenticateDeviceToken(token.accessToken, db)).toBeNull();
  });

  it("parst nur lht_-Bearer-Token", () => {
    expect(deviceBearer("Bearer lht_abc")).toBe("lht_abc");
    expect(deviceBearer("Bearer lhm_abc")).toBeNull();
    expect(deviceBearer(null)).toBeNull();
  });
});

describe("TV-Daten", () => {
  it("liefert Rad- und Kraft-Einheiten im TV-Format", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    await db.plannedWorkout.create({
      data: {
        userId,
        date: tomorrow,
        sport: "bike",
        title: "Sweet Spot",
        plannedDurationMin: 60,
        segmentsJson: [
          { type: "warmup", durationSec: 600, intensity: "warmup" },
          { type: "interval", duration_sec: 300, target_type: "power", target_value: 250 },
          { type: "kaputt" },
        ],
      },
    });
    await db.plannedWorkout.create({
      data: { userId, date: tomorrow, sport: "run", title: "Lauf", plannedDurationMin: 40 },
    });
    await db.plannedWorkout.create({
      data: {
        userId,
        date: tomorrow,
        sport: "strength",
        title: "Rumpf",
        plannedDurationMin: 20,
        segmentsJson: [
          { type: "warmup", durationSec: 300, description: "Locker einrollen" },
          { type: "other", exercise: { id: "eigene-uebung", sets: 3, holdSec: 30, restSec: 20, perSide: true } },
          { type: "other", exercise: { id: "glute-bridge", sets: 2, reps: 12 } },
        ],
      },
    });
    const list = await listTvWorkouts(userId, {}, db);
    expect(list.map((w) => w.title)).toEqual(["Sweet Spot", "Rumpf"]);
    const bike = list[0];
    expect(bike.kind).toBe("bike");
    expect(bike.segments).toHaveLength(2); // kaputtes Segment verworfen
    expect(bike.segments[1]).toMatchObject({ durationSec: 300, targetType: "power", targetValue: 250 });
    const strength = list[1];
    expect(strength.kind).toBe("strength");
    expect(strength.steps[0]).toMatchObject({ kind: "text", title: "Aufwärmen" });
    expect(strength.steps[1]).toMatchObject({
      kind: "exercise",
      title: "eigene-uebung",
      sets: 3,
      holdSec: 30,
      restSec: 20,
      perSide: true,
      dose: "3 × 30 s pro Seite",
    });
    // Bibliotheksübung: Titel aufgelöst, Wiederholungen statt Halten
    expect(strength.steps[2]).toMatchObject({ kind: "exercise", reps: 12, holdSec: null, restSec: 0, dose: "2 × 12" });
    expect(strength.steps[2].kind === "exercise" && strength.steps[2].title).not.toBe("glute-bridge");
  });

  it("validiert Aktivitäts-Uploads und rundet Int-Spalten", () => {
    expect(parseActivityInput(null)).toEqual({ ok: false, error: "Ungültiger Body." });
    expect(parseActivityInput({ durationMin: 0 }).ok).toBe(false);
    const p = parseActivityInput({ durationMin: 61.5, avgHr: 141.6, avgPower: 201.4, distanceKm: 30.25, samples: [1, 2] });
    if (!p.ok) throw new Error("ungültig");
    const data = activityCreateData("u1", p.input, { source: "brick-tv", externalId: "abc12345" });
    expect(data).toMatchObject({ avgHr: 142, avgPower: 201, distanceM: 30250, sport: "bike", externalId: "abc12345" });
  });
});
