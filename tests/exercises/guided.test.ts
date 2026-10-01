import { describe, it, expect } from "vitest";
import { exerciseIdsFromSegments, isGuidedWorkout } from "@/domain/exercises/guided";

describe("isGuidedWorkout", () => {
  it("führt Kraft, Mobility und Sonstige (z. B. Mobility als „other“ geplant)", () => {
    expect(isGuidedWorkout("strength", [])).toBe(true);
    expect(isGuidedWorkout("mobility", [])).toBe(true);
    expect(isGuidedWorkout("other", [{ type: "steady", description: "Hüfte mobilisieren" }])).toBe(true);
  });

  it("Ausdauer nur mit Übungssegmenten", () => {
    expect(isGuidedWorkout("bike", [{ type: "steady" }])).toBe(false);
    expect(isGuidedWorkout("run", [{ type: "other", exercise: { id: "plank" } }])).toBe(true);
    expect(isGuidedWorkout("rest", [])).toBe(false);
  });

  it("sammelt Übungs-IDs ohne Duplikate", () => {
    expect(
      exerciseIdsFromSegments([{ exercise: { id: "a" } }, { exercise: null }, { exercise: { id: "a" } }, { exercise: { id: "b" } }]),
    ).toEqual(["a", "b"]);
    expect(exerciseIdsFromSegments("kaputt")).toEqual([]);
  });
});
