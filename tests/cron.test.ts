import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/cron/sync/route";
import { isSyncDue } from "@/lib/sync-schedule";

describe("isSyncDue", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  it("ist fällig, wenn noch nie synchronisiert wurde", () => {
    expect(isSyncDue(null, 30, now)).toBe(true);
  });

  it("ist nicht fällig innerhalb des Intervalls", () => {
    const last = new Date(now.getTime() - 5 * 60000); // vor 5 min
    expect(isSyncDue(last, 30, now)).toBe(false);
  });

  it("ist fällig, sobald das Intervall überschritten ist", () => {
    const last = new Date(now.getTime() - 31 * 60000); // vor 31 min
    expect(isSyncDue(last, 30, now)).toBe(true);
  });
});

describe("GET /api/cron/sync – CRON_SECRET", () => {
  it("lehnt Anfragen ohne Auth-Header ab", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(new Request("http://x/api/cron/sync"));
    expect(res.status).toBe(401);
  });

  it("lehnt Anfragen mit falschem Token ab", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(
      new Request("http://x/api/cron/sync", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
  });
});
