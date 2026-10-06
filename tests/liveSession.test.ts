import { describe, expect, it } from "vitest";
import {
  LIVE_STALE_MS,
  getLive,
  liveSnapshotSchema,
  publishLive,
  subscribeLive,
  type LiveSnapshot,
} from "@/lib/live-session";

const bike: LiveSnapshot = {
  kind: "bike",
  title: "Sweetspot",
  running: true,
  elapsedSec: 120,
  totalSec: 3600,
  ftp: 250,
  offsetW: 0,
  powerW: 200,
  cadenceRpm: 90,
  hrBpm: 140,
  speedKmh: 30,
  step: { index: 1, count: 5, label: "1. work", targetW: 220, remainingSec: 60 },
  next: { label: "2. rest", targetW: 0, durationSec: 60 },
  profile: [{ d: 600, w: 150 }],
};

describe("live-session", () => {
  it("liefert idle, wenn nichts veröffentlicht wurde", () => {
    expect(getLive("nobody").snapshot.kind).toBe("idle");
  });

  it("speichert Snapshots pro Nutzer und benachrichtigt Abonnenten", () => {
    const seen: string[] = [];
    const off = subscribeLive("u1", (e) => seen.push(e.snapshot.kind));
    publishLive("u1", bike, 1000);
    expect(getLive("u1", 2000).snapshot).toEqual(bike);
    expect(getLive("u2", 2000).snapshot.kind).toBe("idle");
    publishLive("u1", { kind: "idle" }, 3000);
    expect(getLive("u1", 3000).snapshot.kind).toBe("idle");
    off();
    publishLive("u1", bike, 4000);
    expect(seen).toEqual(["bike", "idle"]);
  });

  it("behandelt veraltete Snapshots als idle", () => {
    publishLive("u3", bike, 1000);
    expect(getLive("u3", 1000 + LIVE_STALE_MS).snapshot.kind).toBe("bike");
    expect(getLive("u3", 1000 + LIVE_STALE_MS + 1).snapshot.kind).toBe("idle");
  });

  it("validiert das Schema", () => {
    expect(liveSnapshotSchema.safeParse(bike).success).toBe(true);
    expect(liveSnapshotSchema.safeParse({ kind: "bike" }).success).toBe(false);
    expect(liveSnapshotSchema.safeParse({ ...bike, powerW: Infinity }).success).toBe(false);
    expect(liveSnapshotSchema.safeParse({ ...bike, title: "x".repeat(500) }).success).toBe(false);
    expect(liveSnapshotSchema.safeParse({ kind: "evil" }).success).toBe(false);
  });
});
