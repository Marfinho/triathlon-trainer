import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDb } from "./helpers/testDb";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  const { db, cleanup } = createTestDb();

  beforeAll(async () => {
    await db.user.deleteMany();
  });

  beforeEach(async () => {
    await db.rateLimitEntry.deleteMany();
  });

  afterAll(async () => {
    await cleanup();
  });

  it("erlaubt Anfragen innerhalb des Limits", async () => {
    const r1 = await checkRateLimit("test:a", 3, 60_000, db);
    const r2 = await checkRateLimit("test:a", 3, 60_000, db);
    const r3 = await checkRateLimit("test:a", 3, 60_000, db);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  it("blockt, sobald das Limit erreicht ist", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("test:b", 5, 60_000, db);
    }
    const blocked = await checkRateLimit("test:b", 5, 60_000, db);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("öffnet ein neues Fenster, sobald die alte Window-Zeit abgelaufen ist", async () => {
    await db.rateLimitEntry.create({
      data: { key: "test:c", count: 10, windowStart: new Date(Date.now() - 120_000) },
    });
    const result = await checkRateLimit("test:c", 5, 60_000, db);
    expect(result.allowed).toBe(true);
  });

  it("zählt unterschiedliche Keys unabhängig", async () => {
    await checkRateLimit("test:d1", 1, 60_000, db);
    const other = await checkRateLimit("test:d2", 1, 60_000, db);
    expect(other.allowed).toBe(true);
  });

  it("hält das Limit auch bei parallelen Anfragen ein", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit("test:burst", 3, 60_000, db)),
    );
    expect(results.filter((r) => r.allowed).length).toBeLessThanOrEqual(3);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/", { headers });

  it("nimmt den vom eigenen Proxy angehängten (letzten) X-Forwarded-For-Eintrag", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("fällt auf X-Real-IP und dann 'unknown' zurück", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBe("unknown");
  });
});
