import { describe, it, expect } from "vitest";
import {
  buildPlanVsActual,
  type PlannedInput,
  type ActualInput,
} from "@/domain/training/planVsActual";

const today = new Date("2026-06-15T00:00:00Z");

describe("buildPlanVsActual", () => {
  it("markiert geplant + ist als completed", () => {
    const planned: PlannedInput[] = [
      { id: "p1", date: "2026-06-14", sport: "run", title: "Lauf", plannedDurationMin: 60, status: "planned" },
    ];
    const actual: ActualInput[] = [
      { id: "a1", date: "2026-06-14", sport: "run", durationMin: 58, distanceKm: 10 },
    ];
    const rows = buildPlanVsActual(planned, actual, today);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("completed");
    expect(rows[0].actual?.id).toBe("a1");
  });

  it("markiert vergangene geplante ohne Ist als missed", () => {
    const planned: PlannedInput[] = [
      { id: "p1", date: "2026-06-13", sport: "bike", title: "Rad", plannedDurationMin: 90, status: "planned" },
    ];
    const rows = buildPlanVsActual(planned, [], today);
    expect(rows[0].status).toBe("missed");
  });

  it("markiert zukünftige geplante als upcoming", () => {
    const planned: PlannedInput[] = [
      { id: "p1", date: "2026-06-20", sport: "swim", title: "Schwimmen", plannedDurationMin: 45, status: "planned" },
    ];
    const rows = buildPlanVsActual(planned, [], today);
    expect(rows[0].status).toBe("upcoming");
  });

  it("zeigt completed-Status auch ohne passende Ist-Aktivität", () => {
    const planned: PlannedInput[] = [
      { id: "p1", date: "2026-06-14", sport: "run", title: "Lauf", plannedDurationMin: 60, status: "completed" },
    ];
    const rows = buildPlanVsActual(planned, [], today);
    expect(rows[0].status).toBe("completed");
  });

  it("listet ungeplante Ist-Aktivitäten als unplanned", () => {
    const actual: ActualInput[] = [
      { id: "a1", date: "2026-06-14", sport: "run", durationMin: 30, distanceKm: 5 },
    ];
    const rows = buildPlanVsActual([], actual, today);
    expect(rows[0].status).toBe("unplanned");
  });

  it("ignoriert replaced/cancelled Workouts", () => {
    const planned: PlannedInput[] = [
      { id: "p1", date: "2026-06-14", sport: "run", title: "Alt", plannedDurationMin: 60, status: "replaced" },
    ];
    const rows = buildPlanVsActual(planned, [], today);
    expect(rows).toHaveLength(0);
  });
});
