import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb, resetDb } from "./helpers/testDb";
import { authenticateToken, createMcpToken } from "@/lib/mcp/token";
import { createMcpServer, RACE_WRITE_LIMIT_PER_HOUR } from "@/lib/mcp/server";
import { effectivePlan, createRaceForUser, updateRaceForUser } from "@/domain/races/raceService";

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

const NOW = new Date("2026-11-14T08:00:00Z");

type Geo = { lat: number; lon: number; displayName: string } | null;
async function connect(uid: string, opts: { write?: boolean; geocode?: (n: string) => Promise<Geo>; maxRaces?: number } = {}) {
  const t = await createMcpToken({ userId: uid, name: "t", writePlan: opts.write ?? true }, db);
  const principal = (await authenticateToken(t.token, db))!;
  const server = createMcpServer(principal, db, {
    now: () => NOW,
    race: {
      geocode: opts.geocode ?? (async (n) => ({ lat: 49.2, lon: 11.1, displayName: `${n}, Deutschland` })),
      maxRaces: async () => opts.maxRaces ?? Infinity,
    },
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(ct);
  return { client, principal };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args }).catch((e: Error) => ({
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: "SDK_REJECTED", message: e.message }) }],
  }))) as { content: { text: string }[]; isError?: boolean };
  const text = res.content[0].text;
  // Schema-Verstöße meldet das SDK als Klartext ("MCP error -32602 …"), Tool-Fehler als JSON.
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: "SCHEMA_REJECTED", message: text };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { isError: !!res.isError, data: data as Record<string, any> };
}

describe("Rennen per MCP", () => {
  it("bietet die Renn-Tools nur mit Schreibrecht an", async () => {
    const ro = await connect(userId, { write: false });
    const roNames = (await ro.client.listTools()).tools.map((t) => t.name);
    expect(roNames).not.toContain("create_race");
    expect(roNames).not.toContain("update_race");
    const rw = await connect(userId);
    const rwNames = (await rw.client.listTools()).tools.map((t) => t.name);
    expect(rwNames).toEqual(expect.arrayContaining(["create_race", "update_race", "apply_plan"]));
  });

  it("legt ein Rennen an, löst den Ort auf und liefert es in get_profile", async () => {
    const { client } = await connect(userId);
    const { data, isError } = await call(client, "create_race", {
      name: "Challenge Roth", date: "2027-07-04", type: "triathlon", distance: "Langdistanz", priority: "A", locationName: "Roth", notes: "Saisonhöhepunkt",
    });
    expect(isError).toBe(false);
    expect(data).toMatchObject({ ok: true, created: true });
    expect(data.race).toMatchObject({ name: "Challenge Roth", date: "2027-07-04", priority: "A", locationName: "Roth, Deutschland", lat: 49.2, lon: 11.1, completed: false });

    const row = await db.raceEvent.findFirstOrThrow({ where: { userId } });
    expect(row.date.toISOString()).toBe("2027-07-04T00:00:00.000Z");

    const profile = await call(client, "get_profile");
    expect(profile.data.races.map((r: { name: string }) => r.name)).toEqual(["Challenge Roth"]);
  });

  it("verwendet Standardwerte (Typ triathlon, Priorität B)", async () => {
    const { client } = await connect(userId);
    const { data } = await call(client, "create_race", { name: "Stadtlauf", date: "2027-03-01" });
    expect(data.race).toMatchObject({ type: "triathlon", priority: "B", locationName: null, lat: null });
  });

  it("legt keine Duplikate an (gleicher Name + Datum, Groß-/Kleinschreibung egal)", async () => {
    const { client } = await connect(userId);
    const a = await call(client, "create_race", { name: "Ironman Frankfurt", date: "2027-06-27" });
    const b = await call(client, "create_race", { name: "ironman frankfurt ", date: "2027-06-27" });
    expect(b.data).toMatchObject({ ok: true, created: false });
    expect(b.data.race.id).toBe(a.data.race.id);
    expect(await db.raceEvent.count({ where: { userId } })).toBe(1);
    // anderes Datum = anderes Rennen
    await call(client, "create_race", { name: "Ironman Frankfurt", date: "2028-06-25" });
    expect(await db.raceEvent.count({ where: { userId } })).toBe(2);
  });

  it.each([
    ["ungültiger Kalendertag", { date: "2027-02-30" }],
    ["falsches Format", { date: "04.07.2027" }],
    ["zu alt", { date: "1999-12-31" }],
    ["zu weit in der Zukunft", { date: "2050-01-01" }],
    ["leerer Name", { name: "" }],
    ["unbekannter Typ", { type: "marathon-swim" }],
    ["unbekannte Priorität", { priority: "Z" }],
    ["zu langer Name", { name: "x".repeat(201) }],
  ])("lehnt ab: %s", async (_n, override) => {
    const { client } = await connect(userId);
    const { isError } = await call(client, "create_race", { name: "Test", date: "2027-05-01", ...override });
    expect(isError).toBe(true);
    expect(await db.raceEvent.count()).toBe(0);
  });

  it("härtet Texte (Steuerzeichen) und kappt Längen", async () => {
    const { client } = await connect(userId);
    const { data } = await call(client, "create_race", { name: "Lauf\u0000\u0007 Cup", date: "2027-04-10", notes: "a\u0000b" + "n".repeat(1990) });
    expect(data.race.name).toBe("Lauf Cup");
    expect(data.race.notes.startsWith("ab")).toBe(true);
    expect(data.race.notes.length).toBe(1992);
    // Längere Notizen lehnt schon das Schema ab.
    const tooLong = await call(client, "create_race", { name: "Lang", date: "2027-04-11", notes: "n".repeat(2001) });
    expect(tooLong.isError).toBe(true);
  });

  it("fällt bei Geocoding-Fehlern auf den Ort als Text zurück", async () => {
    const { client } = await connect(userId, { geocode: async () => { throw new Error("offline"); } });
    const { data, isError } = await call(client, "create_race", { name: "Halbmarathon", date: "2027-04-18", locationName: "Hamburg" });
    expect(isError).toBe(false);
    expect(data.race).toMatchObject({ locationName: "Hamburg", lat: null, lon: null });
  });

  it("beachtet das Rennlimit des Tarifs", async () => {
    const { client } = await connect(userId, { maxRaces: 2 });
    await call(client, "create_race", { name: "R1", date: "2027-05-01" });
    await call(client, "create_race", { name: "R2", date: "2027-06-01" });
    const third = await call(client, "create_race", { name: "R3", date: "2027-07-01" });
    expect(third.isError).toBe(true);
    expect(third.data.error).toBe("LIMIT_REACHED");
    expect(await db.raceEvent.count({ where: { userId } })).toBe(2);
    // ein Duplikat zählt nicht gegen das Limit und bleibt erlaubt
    expect((await call(client, "create_race", { name: "R1", date: "2027-05-01" })).data.created).toBe(false);
  });

  it("schreibt Audit-Einträge ohne Freitext", async () => {
    const { client, principal } = await connect(userId);
    const { data } = await call(client, "create_race", { name: "Geheimer Name", date: "2027-05-01", notes: "privat" });
    await call(client, "update_race", { id: data.race.id, completed: true });
    const audit = await db.auditLog.findMany({ where: { userId, action: { in: ["mcp.create_race", "mcp.update_race"] } } });
    expect(audit.map((a) => a.action).sort()).toEqual(["mcp.create_race", "mcp.update_race"]);
    const text = JSON.stringify(audit);
    expect(text).toContain(principal.tokenId);
    expect(text).not.toContain("Geheimer Name");
    expect(text).not.toContain("privat");
  });

  it("ist pro Token rate-limitiert", async () => {
    const { client } = await connect(userId);
    let limited = false;
    for (let i = 0; i < RACE_WRITE_LIMIT_PER_HOUR + 3; i++) {
      const { data } = await call(client, "create_race", { name: `Lauf ${i}`, date: "2027-05-01" });
      if (data.error === "RATE_LIMITED") limited = true;
    }
    expect(limited).toBe(true);
  });

  it("verweigert Schreibaufrufe ohne Scope auch direkt", async () => {
    const { client } = await connect(userId, { write: false });
    const { isError } = await call(client, "create_race", { name: "X", date: "2027-05-01" });
    expect(isError).toBe(true);
    expect(await db.raceEvent.count()).toBe(0);
  });
});

describe("update_race", () => {
  async function seedRace(uid = userId, name = "Seeding Cup") {
    return db.raceEvent.create({ data: { userId: uid, name, date: new Date("2027-05-01T00:00:00Z"), type: "run", priority: "B" } });
  }

  it("trägt ein Ergebnis ein und ändert Stammdaten", async () => {
    const race = await seedRace();
    const { client } = await connect(userId);
    const { data, isError } = await call(client, "update_race", {
      id: race.id, completed: true, resultSeconds: 5400, resultPlacement: 12, resultNote: "Gute Beine", priority: "A", date: "2027-05-02", locationName: "Berlin",
    });
    expect(isError).toBe(false);
    expect(data.race).toMatchObject({ completed: true, resultSeconds: 5400, resultPlacement: 12, resultNote: "Gute Beine", priority: "A", date: "2027-05-02", locationName: "Berlin, Deutschland", lat: 49.2 });
    expect(data.race.name).toBe("Seeding Cup");
  });

  it("kann das Ergebnis zurücksetzen (resultSeconds=null)", async () => {
    const race = await db.raceEvent.create({ data: { userId, name: "R", date: NOW, type: "run", resultSeconds: 3000 } });
    const { client } = await connect(userId);
    const { data } = await call(client, "update_race", { id: race.id, resultSeconds: null });
    expect(data.race.resultSeconds).toBeNull();
  });

  it("fasst Rennen anderer Nutzer nie an (Mandantentrennung)", async () => {
    const other = await db.user.create({ data: { email: `o-${Date.now()}@example.com` } });
    const foreign = await seedRace(other.id, "Fremdes Rennen");
    const { client } = await connect(userId);
    const { data, isError } = await call(client, "update_race", { id: foreign.id, name: "GEHACKT", completed: true });
    expect(isError).toBe(true);
    expect(data.error).toBe("NOT_FOUND");
    const row = await db.raceEvent.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(row).toMatchObject({ name: "Fremdes Rennen", completed: false });
    // und das Profil zeigt fremde Rennen nicht
    await seedRace(userId, "Eigenes");
    const profile = await call(client, "get_profile");
    expect(JSON.stringify(profile.data)).not.toContain("Fremdes Rennen");
  });

  it("lehnt leere und ungültige Änderungen ab", async () => {
    const race = await seedRace();
    const { client } = await connect(userId);
    expect((await call(client, "update_race", { id: race.id })).data.error).toBe("INVALID_INPUT");
    expect((await call(client, "update_race", { id: race.id, date: "2027-13-01" })).isError).toBe(true);
    expect((await call(client, "update_race", { id: race.id, resultSeconds: -5 })).isError).toBe(true);
    expect((await call(client, "update_race", { id: race.id, priority: "Q" })).isError).toBe(true);
    expect((await call(client, "update_race", { id: "nope" , name: "x" })).data.error).toBe("NOT_FOUND");
    expect((await db.raceEvent.findUniqueOrThrow({ where: { id: race.id } })).name).toBe("Seeding Cup");
  });

  it("bietet kein Löschen an", async () => {
    const { client } = await connect(userId);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names.some((n) => n.includes("delete"))).toBe(false);
  });
});

describe("raceService", () => {
  it("behandelt ein abgelaufenes paid-Abo als free", async () => {
    await db.user.update({ where: { id: userId }, data: { plan: "paid", planExpiresAt: new Date(Date.now() - 1000) } });
    expect(await effectivePlan(userId, db)).toBe("free");
    await db.user.update({ where: { id: userId }, data: { planExpiresAt: null } });
    expect(await effectivePlan(userId, db)).toBe("paid");
  });

  it("meldet Limit mit Details und ändert bei NOT_FOUND nichts", async () => {
    const deps = { db, maxRaces: async () => 0, geocode: async () => null };
    const res = await createRaceForUser(userId, "free", { name: "X", date: "2027-01-01" }, deps);
    expect(res).toMatchObject({ ok: false, error: "LIMIT_REACHED", limit: 0, current: 0, tier: "free" });
    expect(await updateRaceForUser(userId, "gibtsnicht", { name: "Y" }, deps)).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});
