import { describe, it, expect } from "vitest";
import { estimateExerciseDurationSec, formatExerciseDose } from "@/domain/exercises/duration";

const def = { tempo: { toEndSec: 1, holdEndSec: 1, toStartSec: 2, holdStartSec: 1 } };

describe("estimateExerciseDurationSec", () => {
  it("rechnet Wiederholungen × Tempo plus Pausen", () => {
    // 3 Sätze × (8 × 5 s) + 2 × 30 s
    expect(
      estimateExerciseDurationSec({ sets: 3, reps: 8, holdSec: null, restSec: 30, perSide: false }, def),
    ).toBe(3 * 40 + 60);
  });

  it("verdoppelt pro Seite", () => {
    expect(
      estimateExerciseDurationSec({ sets: 2, reps: 10, holdSec: null, restSec: 0, perSide: true }, def),
    ).toBe(2 * 100);
  });

  it("nimmt bei Halteübungen holdSec", () => {
    expect(
      estimateExerciseDurationSec({ sets: 3, reps: null, holdSec: 20, restSec: 30, perSide: true }, def),
    ).toBe(3 * 40 + 60);
  });

  it("ein Satz ohne Pause", () => {
    expect(
      estimateExerciseDurationSec({ sets: 1, reps: null, holdSec: 45, restSec: null, perSide: false }, def),
    ).toBe(45);
  });
});

describe("formatExerciseDose", () => {
  it("formatiert Wiederholungen, Halten, Seite und Gewicht", () => {
    expect(formatExerciseDose({ sets: 3, reps: 8, holdSec: null, perSide: true, loadKg: null })).toBe(
      "3 × 8 pro Seite",
    );
    expect(formatExerciseDose({ sets: 2, reps: null, holdSec: 30, perSide: false, loadKg: 12 })).toBe(
      "2 × 30 s · 12 kg",
    );
  });
});
