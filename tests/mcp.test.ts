import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb, resetDb } from "./helpers/testDb";
import {
  authenticateToken,
  bearerFromHeader,
  createMcpToken,
  hashToken,
  revokeMcpToken,
} from "@/lib/mcp/token";
import { createMcpServer } from "@/lib/mcp/server";
import { handleMcpRequest, AUTH_FAIL_LIMIT } from "@/lib/mcp/handler";
import { resolveRange, getNutrition, getActivities, McpInputError } from "@/lib/mcp/readers";

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
});

const NOW = new Date("2026-10-06T08:00:00Z");

async function seed(uid: string, tag = "") {
  await db.athleteProfile.create({ data: { userId: uid, name: `Athlet${tag}`, thresholdHr: 170 } });
  for (let i = 0; i < 20; i++) {
    await db.actualActivity.create({
      data: {
        userId: uid, source: "intervals", externalId: `${tag}a${i}`,
        date: new Date(NOW.getTime() - i * 86_400_000), sport: i % 2 ? "run" : "bike",
        durationMin: 60, distanceKm: 10, rpe: 5, avgHr: 150, notes: `geheim${tag}`,
      },
    });
  }
  await db.plannedWorkout.create({
    data: { userId: uid, date: new Date("2026-10-07T00:00:00Z"), sport: "run", title: `Lauf${tag}`, plannedDurationMin: 45 },
  });
  await db.raceEvent.create({
    data: { userId: uid, name: `Rennen${tag}`, date: new Date("2026-11-15T00:00:00Z"), type: "run", distance: "10k", priority: "A" },
  });
  await db.readinessSnapshot.create({ data: { userId: uid, date: new Date("2026-10-05T00:00:00Z"), status: "ok", subjectiveFatigue: 3 } });
}

function validPlan(start = "2026-10-08") {
  return {
    schemaVersion: "1.0",
    type: "localhub_plan",
    planName: "MCP-Woche",
    generatedAt: "2026-10-06T10:00:00Z",
    planStart: start,
    planDays: 2,
    planEnd: "2026-10-09",
    entries: [
      { date: "2026-10-08", sport: "run", title: "Lauf", plannedDurationMin: 60, plannedDistanceM: 10000, rpe: 3, description: null, segments: [] },
      { date: "2026-10-09", sport: "rest", title: "Ruhetag", plannedDurationMin: 0, plannedDistanceM: null, rpe: null, description: null, segments: [] },
    ],
  };
}

async function connect(principal: Parameters<typeof createMcpServer>[0]) {
  const server = createMcpServer(principal, db, { now: () => NOW, instantSync: async () => ({ skipped: true }) });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(ct);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { isError: !!res.isError, data: JSON.parse(res.content[0].text) };
}

async function principalFor(uid: string, writePlan = false) {
  const t = await createMcpToken({ userId: uid, name: "test", writePlan }, db);
  const p = await authenticateToken(t.token, db);
  return { token: t.token, principal: p! };
}

describe("MCP-Token", () => {
  it("speichert nur den Hash, nie das Klartext-Token", async () => {
    const t = await createMcpToken({ userId, name: "x" }, db);
    expect(t.token.startsWith("lhm_")).toBe(true);
    expect(t.token.length).toBeGreaterThan(40);
    const row = await db.mcpToken.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.tokenHash).toBe(hashToken(t.token));
    expect(JSON.stringify(row)).not.toContain(t.token);
    expect(row.scopes).toEqual(["read"]);
  });

  it("authentifiziert gültige Token mit Scopes", async () => {
    const t = await createMcpToken({ userId, name: "x", writePlan: true }, db);
    const p = await authenticateToken(t.token, db);
    expect(p).toMatchObject({ userId, scopes: ["read", "write_plan"] });
  });

  it("lehnt unbekannte, widerrufene und abgelaufene Token ab", async () => {
    expect(await authenticateToken("lhm_unbekannt", db)).toBeNull();
    const t = await createMcpToken({ userId, name: "x" }, db);
    expect(await revokeMcpToken(t.id, db)).toBe(true);
    expect(await revokeMcpToken(t.id, db)).toBe(false);
    expect(await authenticateToken(t.token, db)).toBeNull();

    const e = await createMcpToken({ userId, name: "alt" }, db);
    await db.mcpToken.update({ where: { id: e.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await authenticateToken(e.token, db)).toBeNull();
  });

  it("Scope-Liste in der DB kann Rechte nicht über die Whitelist hinaus erweitern", async () => {
    const t = await createMcpToken({ userId, name: "x" }, db);
    await db.mcpToken.update({ where: { id: t.id }, data: { scopes: ["admin", "write_plan", 5] } });
    const p = await authenticateToken(t.token, db);
    expect(p?.scopes.sort()).toEqual(["read", "write_plan"]);
  });

  it("parst den Authorization-Header strikt", () => {
    expect(bearerFromHeader("Bearer lhm_abc")).toBe("lhm_abc");
    expect(bearerFromHeader("bearer lhm_abc")).toBe("lhm_abc");
    expect(bearerFromHeader("Basic lhm_abc")).toBeNull();
    expect(bearerFromHeader("Bearer abc")).toBeNull();
    expect(bearerFromHeader("Bearer lhm_a b")).toBeNull();
    expect(bearerFromHeader("Bearer lhm_" + "a".repeat(200))).toBeNull();
    expect(bearerFromHeader(null)).toBeNull();
  });
});

describe("Zeitfenster-Validierung", () => {
  it("lehnt ungültige Daten, falsche Reihenfolge und zu große Fenster ab", () => {
    expect(() => resolveRange("2026-02-30", undefined, { backDays: 1, forwardDays: 1 })).toThrow(McpInputError);
    expect(() => resolveRange("morgen", undefined, { backDays: 1, forwardDays: 1 })).toThrow(McpInputError);
    expect(() => resolveRange("2026-10-10", "2026-10-01", { backDays: 1, forwardDays: 1 })).toThrow(McpInputError);
    expect(() => resolveRange("2020-01-01", "2026-01-01", { backDays: 1, forwardDays: 1 })).toThrow(McpInputError);
  });
  it("macht das Ende inklusive", () => {
    const r = resolveRange("2026-10-01", "2026-10-02", { backDays: 1, forwardDays: 1 });
    expect(r.toInclusive.toISOString()).toBe("2026-10-02T23:59:59.999Z");
  });
});

describe("MCP-Tools (In-Memory-Client)", () => {
  it("listet Lese-Tools; apply_plan nur mit write_plan-Scope", async () => {
    const ro = await connect((await principalFor(userId)).principal);
    const names = (await ro.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_overview", "get_activities", "validate_plan", "get_coach_summary"]));
    expect(names).not.toContain("apply_plan");

    const rw = await connect((await principalFor(userId, true)).principal);
    expect((await rw.listTools()).tools.map((t) => t.name)).toContain("apply_plan");
  });

  it("get_overview liefert Form, Plan, Rennen und Readiness", async () => {
    await seed(userId);
    const client = await connect((await principalFor(userId)).principal);
    const { data, isError } = await call(client, "get_overview");
    expect(isError).toBe(false);
    expect(data.today).toBe("2026-10-06");
    expect(data.form.ctl).toBeGreaterThan(0);
    expect(data.nextRace).toMatchObject({ name: "Rennen", daysToRace: 40 });
    expect(data.thisWeek.workouts).toHaveLength(1);
    expect(data.readinessLatest.status).toBe("ok");
    expect(data.last7Days.length).toBe(7);
    expect(data.athlete.name).toBe("Athlet");
    // Keine internen Felder durchreichen.
    expect(JSON.stringify(data)).not.toContain("passwordHash");
  });

  it("isoliert Mandanten: ein Token sieht nie Daten eines anderen Nutzers", async () => {
    await seed(userId, "A");
    const other = await db.user.create({ data: { email: `other-${Date.now()}@example.com` } });
    await seed(other.id, "B");

    const client = await connect((await principalFor(userId)).principal);
    for (const tool of ["get_overview", "get_activities", "get_planned_workouts", "get_profile", "get_wellbeing", "get_coach_summary"]) {
      const { data } = await call(client, tool, tool === "get_activities" ? { limit: 500 } : {});
      const text = JSON.stringify(data);
      for (const marker of ["AthletB", "LaufB", "RennenB", "geheimB"]) {
        expect(text, `${tool} leakt ${marker}`).not.toContain(marker);
      }
    }
    const { data } = await call(client, "get_activities", { limit: 500 });
    expect(data.every((a: { notes: string }) => a.notes === "geheimA")).toBe(true);
  });

  it("lässt sich nicht per Argument auf einen anderen Nutzer umlenken", async () => {
    await seed(userId, "A");
    const other = await db.user.create({ data: { email: `o2-${Date.now()}@example.com` } });
    await seed(other.id, "B");
    const client = await connect((await principalFor(userId)).principal);
    const { data } = await call(client, "get_activities", { userId: other.id, limit: 500 });
    expect(JSON.stringify(data)).not.toContain("geheimB");
  });

  it("meldet ungültige Eingaben als Tool-Fehler", async () => {
    const client = await connect((await principalFor(userId)).principal);
    const res = await client.callTool({ name: "get_activities", arguments: { from: "kaputt" } }).catch((e) => e);
    // Zod-Validierung des SDK oder Handler-Fehler – in jedem Fall kein Erfolg.
    expect(res instanceof Error || (res as { isError?: boolean }).isError).toBeTruthy();
    const big = await call(client, "get_activities", { from: "2000-01-01", to: "2026-01-01" });
    expect(big.isError).toBe(true);
    expect(big.data.error).toBe("INVALID_INPUT");
  });

  it("gibt Ernährungsdaten nur mit Einwilligung heraus", async () => {
    const client = await connect((await principalFor(userId)).principal);
    const denied = await call(client, "get_nutrition");
    expect(denied.data.error).toBe("NUTRITION_CONSENT_REQUIRED");
    await db.user.update({ where: { id: userId }, data: { nutritionConsentAt: NOW } });
    const p = await db.foodProduct.create({ data: { name: "Haferflocken", kcalPer100g: 370 } as never });
    await db.foodLog.create({ data: { userId, foodProductId: p.id, date: new Date("2026-10-05T00:00:00Z"), quantityG: 100, kcal: 370 } });
    const okRes = await getNutrition(db, userId, {}, NOW);
    expect((okRes as { dailyTotals: { kcal: number }[] }).dailyTotals[0].kcal).toBe(370);
  });

  it("get_coach_summary speichert nichts", async () => {
    await seed(userId);
    const client = await connect((await principalFor(userId)).principal);
    const { data, isError } = await call(client, "get_coach_summary", { planStart: "2026-10-08", planDays: 3 });
    expect(isError).toBe(false);
    expect(data.requestedOutput.planDays).toBe(3);
    expect(await db.coachSummaryExport.count({ where: { userId } })).toBe(0);
  });

  it("validate_plan ändert nichts; ungültige Pläne werden gemeldet", async () => {
    const client = await connect((await principalFor(userId)).principal);
    const good = await call(client, "validate_plan", { plan: validPlan() });
    expect(good.data.valid).toBe(true);
    expect(await db.plannedWorkout.count({ where: { userId } })).toBe(0);

    const bad = await call(client, "validate_plan", { plan: { schemaVersion: "1.0", type: "x" } });
    expect(bad.data.valid).toBe(false);
    const notJson = await call(client, "validate_plan", { plan: "{kaputt" });
    expect(notJson.data.error).toBe("INVALID_INPUT");
  });

  it("apply_plan importiert, schützt Ist-Aktivitäten und schreibt Audit-Log", async () => {
    await seed(userId);
    const { principal } = await principalFor(userId, true);
    const client = await connect(principal);
    const before = await db.actualActivity.count({ where: { userId } });

    const { data, isError } = await call(client, "apply_plan", { plan: validPlan() });
    expect(isError).toBe(false);
    expect(data.ok).toBe(true);
    expect(data.sync).toEqual({ skipped: true });

    const workouts = await db.plannedWorkout.findMany({ where: { userId, source: { not: undefined } } });
    expect(workouts.some((w) => w.title === "Lauf" && w.date.toISOString().startsWith("2026-10-08"))).toBe(true);
    expect(await db.actualActivity.count({ where: { userId } })).toBe(before);

    const audit = await db.auditLog.findMany({ where: { userId, action: "mcp.apply_plan" } });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0].meta)).toContain(principal.tokenId);
    expect(JSON.stringify(audit[0].meta)).not.toContain("lhm_");
  });

  it("apply_plan lehnt ungültige Pläne ab und ändert nichts", async () => {
    const { principal } = await principalFor(userId, true);
    const client = await connect(principal);
    const bad = validPlan();
    bad.planDays = 5; // passt nicht zu planEnd/entries
    const { data, isError } = await call(client, "apply_plan", { plan: bad });
    expect(isError).toBe(true);
    expect(data.ok).toBe(false);
    expect(await db.plannedWorkout.count({ where: { userId } })).toBe(0);
  });

  it("apply_plan prüft den Scope auch bei direktem Aufruf (Defense in Depth)", async () => {
    const { principal } = await principalFor(userId, false);
    const client = await connect(principal);
    const res = await client.callTool({ name: "apply_plan", arguments: { plan: validPlan() } }).catch((e) => e);
    expect(res instanceof Error || (res as { isError?: boolean }).isError).toBeTruthy();
    expect(await db.plannedWorkout.count({ where: { userId } })).toBe(0);
  });

  it("apply_plan ist pro Token rate-limitiert", async () => {
    const { principal } = await principalFor(userId, true);
    const client = await connect(principal);
    let limited = false;
    for (let i = 0; i < 22; i++) {
      const { data } = await call(client, "apply_plan", { plan: validPlan() });
      if (data.error === "RATE_LIMITED") limited = true;
    }
    expect(limited).toBe(true);
  });

  it("begrenzt die Antwortgröße", async () => {
    for (let i = 0; i < 400; i++) {
      await db.actualActivity.create({
        data: { userId, source: "x", externalId: `big${i}`, date: NOW, sport: "run", notes: "n".repeat(1000) },
      });
    }
    const rows = await getActivities(db, userId, { limit: 500 }, NOW);
    expect(rows.length).toBe(400);
    const client = await connect((await principalFor(userId)).principal);
    const { data, isError } = await call(client, "get_activities", { limit: 500 });
    expect(isError).toBe(true);
    expect(data.error).toBe("RESULT_TOO_LARGE");
  });
});

describe("HTTP-Handler /api/mcp", () => {
  const url = "http://localhost/api/mcp";
  const rpc = (method: string, params: unknown = {}, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
  const headers = (token?: string, extra: Record<string, string> = {}) => ({
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  });
  const init = rpc("initialize", {
    protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" },
  });

  it("verlangt ein Bearer-Token (401 + WWW-Authenticate)", async () => {
    const res = await handleMcpRequest(new Request(url, { method: "POST", headers: headers(), body: init }), { db });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    const bad = await handleMcpRequest(new Request(url, { method: "POST", headers: headers("lhm_falsch"), body: init }), { db });
    expect(bad.status).toBe(401);
    expect(await bad.text()).not.toContain("lhm_falsch");
  });

  it("lehnt widerrufene und abgelaufene Token ab", async () => {
    const t = await createMcpToken({ userId, name: "x" }, db);
    await revokeMcpToken(t.id, db);
    const res = await handleMcpRequest(new Request(url, { method: "POST", headers: headers(t.token), body: init }), { db });
    expect(res.status).toBe(401);
  });

  it("antwortet auf initialize und tools/list mit gültigem Token", async () => {
    const t = await createMcpToken({ userId, name: "x" }, db);
    const r1 = await handleMcpRequest(new Request(url, { method: "POST", headers: headers(t.token), body: init }), { db });
    expect(r1.status).toBe(200);
    expect(r1.headers.get("cache-control")).toBe("no-store");
    const j1 = await r1.json();
    expect(j1.result.serverInfo.name).toBe("localhub");

    const r2 = await handleMcpRequest(new Request(url, { method: "POST", headers: headers(t.token), body: rpc("tools/list", {}, 2) }), { db });
    const j2 = await r2.json();
    const names = j2.result.tools.map((x: { name: string }) => x.name);
    expect(names).toContain("get_overview");
    expect(names).not.toContain("apply_plan");
  });

  it("führt Tool-Aufrufe über HTTP aus und aktualisiert lastUsedAt", async () => {
    await seed(userId);
    const t = await createMcpToken({ userId, name: "x" }, db);
    const r = await handleMcpRequest(
      new Request(url, { method: "POST", headers: headers(t.token), body: rpc("tools/call", { name: "get_profile", arguments: {} }) }),
      { db },
    );
    const j = await r.json();
    expect(JSON.parse(j.result.content[0].text).athlete.name).toBe("Athlet");
    expect((await db.mcpToken.findUniqueOrThrow({ where: { id: t.id } })).lastUsedAt).not.toBeNull();
  });

  it("erlaubt nur POST", async () => {
    const t = await createMcpToken({ userId, name: "x" }, db);
    for (const method of ["GET", "DELETE", "PUT"]) {
      const res = await handleMcpRequest(new Request(url, { method, headers: headers(t.token) }), { db });
      expect(res.status, method).toBe(405);
    }
  });

  it("weist Browser-Origins ab (DNS-Rebinding/CSRF-Schutz)", async () => {
    const t = await createMcpToken({ userId, name: "x" }, db);
    const res = await handleMcpRequest(
      new Request(url, { method: "POST", headers: headers(t.token, { Origin: "https://evil.example" }), body: init }),
      { db },
    );
    expect(res.status).toBe(403);
  });

  it("sperrt nach zu vielen Fehlversuchen je IP (429)", async () => {
    const mk = () =>
      new Request(url, { method: "POST", headers: headers("lhm_x", { "x-forwarded-for": "203.0.113.9" }), body: init });
    const statuses: number[] = [];
    for (let i = 0; i < AUTH_FAIL_LIMIT + 3; i++) statuses.push((await handleMcpRequest(mk(), { db })).status);
    expect(statuses.slice(0, AUTH_FAIL_LIMIT).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(AUTH_FAIL_LIMIT).every((s) => s === 429)).toBe(true);
  });

  it("verweigert zu große Request-Bodies", async () => {
    const t = await createMcpToken({ userId, name: "x" }, db);
    const huge = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "validate_plan", arguments: { plan: "x".repeat(3_000_000) } } });
    const res = await handleMcpRequest(new Request(url, { method: "POST", headers: headers(t.token), body: huge }), { db });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
