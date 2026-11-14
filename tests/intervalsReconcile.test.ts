import { describe, it, expect } from "vitest";
import { planReconcile } from "@/integrations/intervals/reconcile";

const ev = (id: string, ext: string | null, date = "2026-06-15", name = "Dauerlauf", type = "Run") => ({
  id,
  external_id: ext,
  start_date_local: `${date}T00:00:00`,
  name,
  type,
});
const w = (id: string, status: string, date = "2026-06-15", title = "Dauerlauf", sport = "run") => ({
  id,
  status,
  date,
  title,
  sport,
});

describe("planReconcile", () => {
  it("entfernt Einträge zu ersetzten, stornierten und gelöschten Workouts", () => {
    const plan = planReconcile(
      [ev("1", "localhub:a"), ev("2", "localhub:b"), ev("3", "localhub:c"), ev("4", "localhub:d")],
      [w("a", "replaced"), w("b", "cancelled"), w("d", "synced")],
      [{ localWorkoutId: "d", intervalsEventId: "4" }],
    );
    expect(plan.orphans.map((o) => o.eventId).sort()).toEqual(["1", "2", "3"]);
    expect(plan.duplicates).toEqual([]);
  });

  it("behält bei Mehrfach-Einträgen den verknüpften", () => {
    const plan = planReconcile(
      [ev("1", "localhub:a"), ev("2", "localhub:a"), ev("3", "localhub:a")],
      [w("a", "synced")],
      [{ localWorkoutId: "a", intervalsEventId: "2" }],
    );
    expect(plan.duplicates.map((d) => d.eventId).sort()).toEqual(["1", "3"]);
  });

  it("lässt absolvierte Workouts und fremde Einträge unberührt", () => {
    const plan = planReconcile(
      [ev("1", "localhub:a"), ev("9", null, "2026-06-15", "Mein Lauf")],
      [w("a", "completed")],
      [],
    );
    expect(plan.orphans).toEqual([]);
    expect(plan.duplicates).toEqual([]);
    expect(plan.foreignDuplicates).toEqual([]);
  });

  it("meldet fremde Dubletten nur bei passendem Tag, Typ und Namen", () => {
    const plan = planReconcile(
      [
        ev("1", "localhub:a"),
        ev("2", null), // gleicher Tag/Typ/Name -> Dublette
        ev("3", null, "2026-06-16"), // anderer Tag
        ev("4", null, "2026-06-15", "Dauerlauf", "Ride"), // anderer Typ
      ],
      [w("a", "synced")],
      [{ localWorkoutId: "a", intervalsEventId: "1" }],
    );
    expect(plan.foreignDuplicates.map((d) => d.eventId)).toEqual(["2"]);
  });

  it("mehrere Trainings am selben Tag bleiben unabhängig", () => {
    const plan = planReconcile(
      [ev("1", "localhub:a"), ev("2", "localhub:b", "2026-06-15", "Schwimmen", "Swim")],
      [w("a", "synced"), w("b", "synced", "2026-06-15", "Schwimmen", "swim")],
      [
        { localWorkoutId: "a", intervalsEventId: "1" },
        { localWorkoutId: "b", intervalsEventId: "2" },
      ],
    );
    expect(plan).toEqual({ orphans: [], duplicates: [], foreignDuplicates: [] });
  });
});
