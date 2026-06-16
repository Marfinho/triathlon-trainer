import { describe, it, expect } from "vitest";
import {
  buildGoalProgress,
  type GoalActivity,
} from "@/domain/training/goals";

const today = new Date("2026-06-17T00:00:00Z"); // Mittwoch, Wochenmontag = 15.06.

describe("buildGoalProgress", () => {
  const activities: GoalActivity[] = [
    { date: "2026-06-15", sport: "bike", durationMin: 120 },
    { date: "2026-06-16", sport: "run", durationMin: 60 },
    { date: "2026-06-10", sport: "bike", durationMin: 90 }, // Vorwoche -> zählt nicht
  ];

  it("summiert nur das Volumen der laufenden Woche", () => {
    const p = buildGoalProgress(
      [{ sport: "bike", weeklyTargetMin: 300 }],
      activities,
      today,
    );
    expect(p[0].actualMin).toBe(120);
    expect(p[0].pct).toBe(40);
  });

  it("liefert je Zieldisziplin einen Eintrag", () => {
    const p = buildGoalProgress(
      [
        { sport: "bike", weeklyTargetMin: 300 },
        { sport: "run", weeklyTargetMin: 120 },
        { sport: "swim", weeklyTargetMin: 100 },
      ],
      activities,
      today,
    );
    expect(p).toHaveLength(3);
    expect(p.find((x) => x.sport === "run")!.pct).toBe(50);
    expect(p.find((x) => x.sport === "swim")!.actualMin).toBe(0);
  });
});
