import { describe, it, expect } from "vitest";
import {
  hashWorkout,
  parseSegments,
  type HashableWorkout,
} from "@/integrations/intervals/hashWorkout";

function base(): HashableWorkout {
  return {
    date: "2026-06-15",
    sport: "run",
    title: "Dauerlauf",
    plannedDurationMin: 60,
    plannedDistanceM: 10000,
    description: "GA1",
    segments: [
      { type: "warmup", durationSec: 600, rpeTarget: 2 },
      { type: "steady", durationSec: 3000, rpeTarget: 3 },
    ],
  };
}

describe("hashWorkout", () => {
  it("liefert für identischen Inhalt denselben Hash", () => {
    expect(hashWorkout(base())).toBe(hashWorkout(base()));
  });

  it("ist unabhängig von der Schlüsselreihenfolge in Segmenten", () => {
    const a = base();
    const b = base();
    b.segments = [
      { rpeTarget: 2, type: "warmup", durationSec: 600 },
      { durationSec: 3000, type: "steady", rpeTarget: 3 },
    ];
    expect(hashWorkout(a)).toBe(hashWorkout(b));
  });

  it("ändert den Hash bei inhaltlicher Änderung", () => {
    const changed = base();
    changed.plannedDurationMin = 75;
    expect(hashWorkout(changed)).not.toBe(hashWorkout(base()));
  });

  it("behandelt null vs. leere Segmente konsistent", () => {
    const a = { ...base(), segments: [] };
    const b = { ...base(), segments: null as unknown };
    expect(hashWorkout(a)).toBe(hashWorkout(b));
  });

  it("parseSegments liest JSON-String und Array", () => {
    expect(parseSegments('[{"type":"warmup"}]')).toEqual([{ type: "warmup" }]);
    expect(parseSegments([{ type: "steady" }])).toEqual([{ type: "steady" }]);
    expect(parseSegments("kaputt")).toEqual([]);
    expect(parseSegments(null)).toEqual([]);
  });
});
