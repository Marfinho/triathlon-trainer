import { describe, it, expect } from "vitest";
import { buildCoachSummary } from "@/domain/coach-summary/buildCoachSummary";
import { MODULE_PRESETS } from "@/domain/coach-summary/presets";
import { coachSummarySchema } from "@/domain/schemas";

describe("buildCoachSummary", () => {
  it("erzeugt eine schema-konforme coach_summary", () => {
    const summary = buildCoachSummary({
      exportPurpose: "training_plan",
      athleteId: "athlete-1",
      planStart: "2026-06-15",
      planDays: 7,
    });
    const parsed = coachSummarySchema.safeParse(summary);
    expect(parsed.success).toBe(true);
    expect(summary.type).toBe("coach_summary");
    expect(summary.requestedOutput.format).toBe("localhub_plan_json");
    expect(summary.requestedOutput.planDays).toBe(7);
  });

  it("nutzt das Preset des jeweiligen exportPurpose", () => {
    const recovery = buildCoachSummary({
      exportPurpose: "recovery_check",
      planStart: "2026-06-15",
      planDays: 3,
    });
    // gleiche Menge (Reihenfolge wird kanonisch normalisiert).
    expect([...recovery.includedModules].sort()).toEqual(
      [...MODULE_PRESETS.recovery_check].sort(),
    );

    const pain = buildCoachSummary({
      exportPurpose: "pain_check",
      planStart: "2026-06-15",
      planDays: 3,
    });
    expect(pain.includedModules).toContain("pain_status");
    expect(pain.includedModules).not.toContain("sync_state");
  });

  it("respektiert includeModules-Override", () => {
    const summary = buildCoachSummary({
      exportPurpose: "training_plan",
      planStart: "2026-06-15",
      planDays: 7,
      includeModules: ["athlete_profile", "coach_notes"],
    });
    expect(summary.includedModules).toEqual(["athlete_profile", "coach_notes"]);
  });

  it("respektiert excludeModules", () => {
    const summary = buildCoachSummary({
      exportPurpose: "training_plan",
      planStart: "2026-06-15",
      planDays: 7,
      excludeModules: ["sync_state", "pain_status"],
    });
    expect(summary.includedModules).not.toContain("sync_state");
    expect(summary.includedModules).not.toContain("pain_status");
    expect(summary.includedModules).toContain("athlete_profile");
  });

  it("liefert Module in kanonischer Reihenfolge unabhängig von der Eingabe", () => {
    const summary = buildCoachSummary({
      exportPurpose: "training_plan",
      planStart: "2026-06-15",
      planDays: 7,
      includeModules: ["coach_notes", "athlete_profile"],
    });
    expect(summary.includedModules).toEqual([
      "athlete_profile",
      "coach_notes",
    ]);
  });

  it("füllt enthaltene Module mit Kontextdaten, fehlende mit null", () => {
    const summary = buildCoachSummary({
      exportPurpose: "training_plan",
      planStart: "2026-06-15",
      planDays: 7,
      context: {
        athleteProfile: { name: "Sven" },
        readiness: { status: "green" },
      },
    });
    expect(summary.modules.athlete_profile).toEqual({ name: "Sven" });
    expect(summary.modules.readiness).toEqual({ status: "green" });
    expect(summary.modules.sync_state).toBeNull();
    // Module, die nicht enthalten sind, tauchen nicht auf.
    expect("nonexistent" in summary.modules).toBe(false);
  });

  it("baut chatGptInstruction mit den Kernregeln", () => {
    const summary = buildCoachSummary({
      exportPurpose: "training_plan",
      planStart: "2026-06-15",
      planDays: 5,
    });
    expect(summary.chatGptInstruction.role.toLowerCase()).toContain("coach");
    const joined = summary.chatGptInstruction.rules.join(" ");
    expect(joined).toContain("5 Tage ab 2026-06-15");
    expect(joined.toLowerCase()).toContain("rest");
    expect(joined.toLowerCase()).toContain("completed");
  });
});
