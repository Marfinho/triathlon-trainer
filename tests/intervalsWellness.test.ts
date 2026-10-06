import { describe, it, expect, vi } from "vitest";
import { importWellnessFromIntervals } from "@/integrations/intervals/importWellness";
import { MockIntervalsClient } from "./helpers/mockIntervalsClient";

function fakeDb(existing: Record<string, unknown> | null) {
  return {
    bodyMetric: {
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("importWellnessFromIntervals", () => {
  it("legt BodyMetric mit Ruhepuls und HRV an", async () => {
    const client = new MockIntervalsClient();
    client.wellnessList = [{ id: "2026-10-05", restingHR: 48.4, hrv: 71.6 }, { id: "2026-10-04" }];
    const db = fakeDb(null);
    const r = await importWellnessFromIntervals({ db: db as never, client, userId: "u" });
    expect(r).toEqual({ fetched: 2, created: 1, updated: 0 });
    expect(db.bodyMetric.create.mock.calls[0][0].data).toMatchObject({ restingHr: 48, hrv: 72, weightKg: null });
  });

  it("überschreibt vorhandenes Gewicht nicht", async () => {
    const client = new MockIntervalsClient();
    client.wellnessList = [{ id: "2026-10-05", restingHR: 50, weight: 90 }];
    const db = fakeDb({ id: "x", weightKg: 97.79, restingHr: null, hrv: 60 });
    const r = await importWellnessFromIntervals({ db: db as never, client, userId: "u" });
    expect(r.updated).toBe(1);
    expect(db.bodyMetric.update.mock.calls[0][0].data).toEqual({ restingHr: 50, hrv: 60, weightKg: 97.79 });
  });
});
