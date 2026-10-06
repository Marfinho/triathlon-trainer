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

import {
  CODE_TTL_SEC,
  USER_CODE_ALPHABET,
  USER_CODE_LENGTH,
  authenticateDeviceToken,
  createDeviceCode,
  createDeviceToken,
  decideUserCode,
  deviceBearerFromHeader,
  generateUserCode,
  listDeviceTokens,
  lookupUserCode,
  normalizeUserCode,
  pollDeviceCode,
  revokeDeviceToken,
  sanitizeDeviceName,
} from "@/lib/device/pairing";
import { bearerFromHeader } from "@/lib/mcp/token";
import { POST as codePost } from "@/app/api/device/code/route";
import { POST as tokenPost } from "@/app/api/device/token/route";
import { POST as verifyPost } from "@/app/api/device/verify/route";
import { GET as tokensGet, DELETE as tokensDelete } from "@/app/api/device/tokens/route";
import { GET as workoutsGet } from "@/app/api/tv/v1/workouts/route";
import { POST as tvActivityPost } from "@/app/api/tv/v1/activities/route";
import { POST as logoutPost } from "@/app/api/tv/v1/logout/route";
import { GET as liveGet, POST as livePost } from "@/app/api/live/route";
import { POST as webActivityPost } from "@/app/api/activities/route";

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

const json = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Code-Helfer", () => {
  it("erzeugt Codes aus dem eindeutigen Alphabet", () => {
    expect(USER_CODE_ALPHABET).toHaveLength(32);
    expect(new Set(USER_CODE_ALPHABET).size).toBe(32);
    for (const c of "01OI") expect(USER_CODE_ALPHABET).not.toContain(c);
    for (let i = 0; i < 200; i++) {
      const code = generateUserCode();
      expect(code).toHaveLength(USER_CODE_LENGTH);
      expect(normalizeUserCode(code)).toBe(code);
    }
  });

  it("normalisiert Eingaben und weist ungültige ab", () => {
    expect(normalizeUserCode(" ab-c d ")).toBe("ABCD");
    expect(normalizeUserCode("ABC")).toBeNull();
    expect(normalizeUserCode("ABCDE")).toBeNull();
    expect(normalizeUserCode("AB0D")).toBeNull();
    expect(normalizeUserCode(1234)).toBeNull();
  });

  it("säubert Gerätenamen", () => {
    expect(sanitizeDeviceName("<b>Wohnzimmer</b> TV!")).toBe("bWohnzimmerb TV");
    expect(sanitizeDeviceName("")).toBe("Fire TV");
    expect(sanitizeDeviceName(undefined)).toBe("Fire TV");
    expect(sanitizeDeviceName("x".repeat(100))).toHaveLength(40);
  });

  it("trennt Geräte-Token (lht_) und MCP-Token (lhm_)", () => {
    expect(deviceBearerFromHeader("Bearer lht_abc")).toBe("lht_abc");
    expect(deviceBearerFromHeader("Bearer lhm_abc")).toBeNull();
    expect(bearerFromHeader("Bearer lht_abc")).toBeNull();
    expect(deviceBearerFromHeader(null)).toBeNull();
  });
});

describe("Kopplungsablauf (Lib)", () => {
  it("pending → approved → Token, nur einmal einlösbar", async () => {
    const c = await createDeviceCode("Wohnzimmer TV");
    expect(await pollDeviceCode(c.deviceCode)).toEqual({ status: "authorization_pending" });
    expect(await lookupUserCode(c.userCode)).toMatchObject({ deviceName: "Wohnzimmer TV" });

    expect(await decideUserCode({ userCode: c.userCode, userId, approve: true })).toBe(true);
    // Zweite Entscheidung greift nicht mehr.
    expect(await decideUserCode({ userCode: c.userCode, userId, approve: false })).toBe(false);

    const [a, b] = await Promise.all([pollDeviceCode(c.deviceCode), pollDeviceCode(c.deviceCode)]);
    const ok = [a, b].filter((r) => r.status === "ok");
    expect(ok).toHaveLength(1); // parallele Einlösung: genau einmal
    const token = (ok[0] as { token: string }).token;
    expect(token.startsWith("lht_")).toBe(true);
    expect(await pollDeviceCode(c.deviceCode)).toEqual({ status: "invalid_grant" });

    const principal = await authenticateDeviceToken(token);
    expect(principal).toMatchObject({ userId, name: "Wohnzimmer TV", scopes: ["tv"] });
    // Nur der Hash liegt in der DB.
    const rows = await db.deviceToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it("meldet slow_down bei zu schnellem Polling", async () => {
    const c = await createDeviceCode("TV");
    const t0 = new Date();
    expect((await pollDeviceCode(c.deviceCode, db, t0)).status).toBe("authorization_pending");
    expect((await pollDeviceCode(c.deviceCode, db, new Date(t0.getTime() + 1000))).status).toBe("slow_down");
    expect((await pollDeviceCode(c.deviceCode, db, new Date(t0.getTime() + 7000))).status).toBe("authorization_pending");
  });

  it("lehnt ab, läuft ab und kennt ungültige Codes", async () => {
    const denied = await createDeviceCode("TV");
    await decideUserCode({ userCode: denied.userCode, userId, approve: false });
    expect((await pollDeviceCode(denied.deviceCode)).status).toBe("access_denied");

    const old = await createDeviceCode("TV");
    const later = new Date(Date.now() + (CODE_TTL_SEC + 1) * 1000);
    expect((await pollDeviceCode(old.deviceCode, db, later)).status).toBe("expired_token");
    expect(await lookupUserCode(old.userCode, db, later)).toBeNull();
    expect(await decideUserCode({ userCode: old.userCode, userId, approve: true }, db, later)).toBe(false);

    expect((await pollDeviceCode("x".repeat(43))).status).toBe("invalid_grant");
    expect((await pollDeviceCode(undefined)).status).toBe("invalid_grant");
  });

  it("speichert nur den Hash des device_code", async () => {
    const c = await createDeviceCode("TV");
    const row = await db.deviceCode.findFirstOrThrow();
    expect(row.deviceCodeHash).not.toContain(c.deviceCode);
    expect(row.userCode).toBe(c.userCode);
  });

  it("widerruft Token nur für den Besitzer", async () => {
    const t = await createDeviceToken({ userId, name: "TV" });
    const other = await db.user.create({ data: { email: `o-${Date.now()}@example.com` } });
    expect(await revokeDeviceToken(t.id, other.id)).toBe(false);
    expect(await authenticateDeviceToken(t.token)).not.toBeNull();
    expect(await revokeDeviceToken(t.id, userId)).toBe(true);
    expect(await authenticateDeviceToken(t.token)).toBeNull();
    expect(await listDeviceTokens(userId)).toHaveLength(0);
  });
});

describe("HTTP-Flow", () => {
  async function pair(): Promise<string> {
    const res = await codePost(json("/api/device/code", { device_name: "Fire TV Wohnzimmer" }));
    const code = await res.json();
    expect(code.verification_uri_complete).toContain(`/device?code=${code.user_code}`);
    expect(code.interval).toBe(5);

    const pending = await tokenPost(json("/api/device/token", { device_code: code.device_code }));
    expect(pending.status).toBe(400);
    expect((await pending.json()).error).toBe("authorization_pending");

    const look = await verifyPost(json("/api/device/verify", { user_code: code.user_code, action: "lookup" }));
    expect((await look.json()).deviceName).toBe("Fire TV Wohnzimmer");
    const ok = await verifyPost(json("/api/device/verify", { user_code: code.user_code, action: "approve" }));
    expect(ok.status).toBe(200);

    // form-encoded + grant_type wie RFC 8628
    const tokRes = await tokenPost(
      new Request("http://localhost/api/device/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: code.device_code,
        }),
      }),
    );
    expect(tokRes.status).toBe(200);
    const tok = await tokRes.json();
    expect(tok).toMatchObject({ token_type: "Bearer", scope: "tv" });
    return tok.access_token as string;
  }

  it("koppelt ein Gerät end-to-end", async () => {
    const token = await pair();
    expect(token.startsWith("lht_")).toBe(true);
  });

  it("verify verlangt Session und begrenzt Versuche", async () => {
    mockAuth.mockResolvedValue(null);
    const anon = await verifyPost(json("/api/device/verify", { user_code: "ABCD", action: "lookup" }));
    expect(anon.status).toBe(401);

    mockAuth.mockResolvedValue({ user: { id: userId } });
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await verifyPost(json("/api/device/verify", { user_code: "ABCD", action: "lookup" }))).status;
    }
    expect(last).toBe(429);
  });

  it("lehnt falsche Grant-Typen ab", async () => {
    const res = await tokenPost(json("/api/device/token", { grant_type: "password", device_code: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unsupported_grant_type");
  });

  it("TV-Routen akzeptieren Geräte-Token, aber keinen fremden/falschen", async () => {
    const token = await pair();
    mockAuth.mockResolvedValue(null); // keine Session: nur das Token zählt

    await db.athleteProfile.create({ data: { userId, name: "Sven", ftpWatts: 250, thresholdHr: 170 } });
    await db.plannedWorkout.create({
      data: {
        userId,
        date: new Date(Date.now() + 86_400_000),
        sport: "bike",
        title: "Sweetspot",
        plannedDurationMin: 40,
        segmentsJson: [{ type: "work", durationSec: 600, intensity: "z3", targetPowerPctFtp: 90 }],
      },
    });

    const res = await workoutsGet(new Request("http://localhost/api/tv/v1/workouts", { headers: bearer(token) }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.device.name).toBe("Fire TV Wohnzimmer");
    expect(data.athlete.ftpWatts).toBe(250);
    expect(data.bike).toHaveLength(1);
    expect(data.bike[0].timeline.steps.length).toBeGreaterThan(0);

    const noAuth = await workoutsGet(new Request("http://localhost/api/tv/v1/workouts"));
    expect(noAuth.status).toBe(401);
    const bad = await workoutsGet(
      new Request("http://localhost/api/tv/v1/workouts", { headers: bearer("lht_gibtsnicht") }),
    );
    expect(bad.status).toBe(401);
    // Ein MCP-Token ist kein Geräte-Token.
    const mcp = await workoutsGet(
      new Request("http://localhost/api/tv/v1/workouts", { headers: bearer("lhm_irgendwas") }),
    );
    expect(mcp.status).toBe(401);
  });

  it("ein gültiger Cookie-Login wird bei falschem Bearer NICHT als Fallback genutzt", async () => {
    // Session vorhanden, aber ungültiges Token im Header → 401.
    const res = await workoutsGet(
      new Request("http://localhost/api/tv/v1/workouts", { headers: bearer("lht_ungueltig") }),
    );
    expect(res.status).toBe(401);
  });

  it("Geräte-Token öffnet keine Routen außerhalb von TV/Live (requireUser bleibt session-only)", async () => {
    const token = await pair();
    mockAuth.mockResolvedValue(null);
    const res = await webActivityPost(
      json("/api/activities", { sport: "bike", durationMin: 30 }, bearer(token)),
    );
    expect(res.status).toBe(401);
    const list = await tokensGet();
    expect(list.status).toBe(401);
  });

  it("lädt Aktivitäten idempotent hoch (externalId) mit Standardquelle tv", async () => {
    const token = await pair();
    mockAuth.mockResolvedValue(null);
    const body = { sport: "bike", durationMin: 30, avgPower: 180, externalId: "ride-1" };
    const r1 = await tvActivityPost(json("/api/tv/v1/activities", body, bearer(token)));
    const r2 = await tvActivityPost(json("/api/tv/v1/activities", body, bearer(token)));
    const a = await r1.json();
    const b = await r2.json();
    expect(a.ok).toBe(true);
    expect(b).toMatchObject({ ok: true, id: a.id, duplicate: true });
    const rows = await db.actualActivity.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("tv");
  });

  it("Live-State mit Geräte-Token schreiben und lesen", async () => {
    const token = await pair();
    mockAuth.mockResolvedValue(null);
    const strength = {
      kind: "strength", title: "Rumpf", stepIndex: 0, stepCount: 3, finished: false, exercise: null, next: null,
    };
    expect((await livePost(json("/api/live", strength, bearer(token)))).status).toBe(200);
    const got = await liveGet(new Request("http://localhost/api/live", { headers: bearer(token) }));
    expect((await got.json()).snapshot.kind).toBe("strength");
    expect((await livePost(json("/api/live", strength))).status).toBe(401);
  });

  it("Gerät kann sich selbst abmelden; Nutzer kann Geräte entkoppeln", async () => {
    const token = await pair();
    mockAuth.mockResolvedValue(null);
    const out = await logoutPost(json("/api/tv/v1/logout", {}, bearer(token)));
    expect(out.status).toBe(200);
    expect(await authenticateDeviceToken(token)).toBeNull();

    const second = await createDeviceToken({ userId, name: "Zweites TV" });
    mockAuth.mockResolvedValue({ user: { id: userId } });
    const list = await (await tokensGet()).json();
    expect(list.devices.map((d: { name: string }) => d.name)).toEqual(["Zweites TV"]);
    const del = await tokensDelete(
      new Request("http://localhost/api/device/tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: second.id }),
      }),
    );
    expect(del.status).toBe(200);
    expect(await authenticateDeviceToken(second.token)).toBeNull();
  });
});
