import { describe, it, expect } from "vitest";
import { exerciseSummaryText } from "@/domain/exercises/summaryText";

describe("exerciseSummaryText", () => {
  it("baut einen lesbaren Übungstext", () => {
    const segs = [
      { type: "warmup", description: "ohne Übung" },
      { type: "other", exercise: { id: "clamshell", sets: 2, reps: 15, perSide: true } },
      { type: "other", exercise: { id: "plank", sets: 3, holdSec: 30 } },
      { type: "other", exercise: { id: "bird-dog", sets: 3, reps: 8, perSide: true, loadKg: 2 } },
    ];
    expect(exerciseSummaryText(segs, "strength")).toBe(
      "Kraft: Clamshell 2 × 15 je Seite, Plank 3 × 30 s, bird-dog 3 × 8 je Seite (2 kg)",
    );
    expect(exerciseSummaryText(segs.slice(1, 2), "mobility")).toMatch(/^Mobility: /);
  });

  it("liefert null ohne Übungssegmente", () => {
    expect(exerciseSummaryText([{ type: "steady" }], "run")).toBeNull();
    expect(exerciseSummaryText(null, "run")).toBeNull();
  });
});
