import { describe, it, expect } from "vitest";
import { buildCoachSummary } from "@/domain/coach-summary/buildCoachSummary";
import { coachSummarySchema } from "@/domain/schemas";
import { exerciseDefinitionSchema } from "@/domain/exercises/schema";
import { exercise3dDefinitionSchema, validateExercise3d } from "@/domain/exercises/body3d";
import catalogFixture from "../fixtures/exercises/example-exercise-catalog.json";
import birdDog from "../fixtures/exercises/example-custom-exercise.json";

const base = { planStart: "2026-10-06", planDays: 7 } as const;
const birdDogDef = exerciseDefinitionSchema.parse(birdDog);

describe("Coach-Export: Übungskatalog", () => {
  it("liefert den Katalog bei training_plan im Format des Beispiels", () => {
    const s = buildCoachSummary({ ...base, exportPurpose: "training_plan" });
    expect(coachSummarySchema.safeParse(s).success).toBe(true);
    expect(s.exerciseCatalog).toEqual(catalogFixture);
    // 3D-Bauplan und Beispiel sind bei Plan-Exporten immer dabei
    expect(s.allowCustomExercises).toBe(true);
    expect(s.exerciseDefinitionGuide).toContain("3D-FORMAT");
    expect((s.exerciseDefinitionExample as { format: string }).format).toBe("3d");
  });

  it("liefert den Katalog auch bei plan_review", () => {
    const s = buildCoachSummary({ ...base, exportPurpose: "plan_review" });
    expect(s.exerciseCatalog).toHaveLength(20);
  });

  it("lässt den Katalog bei debug und anderen Zwecken weg", () => {
    for (const exportPurpose of ["debug", "week_analysis", "recovery_check"] as const) {
      const s = buildCoachSummary({ ...base, exportPurpose, allowCustomExercises: true });
      expect(s.exerciseCatalog).toBeUndefined();
      expect(s.exerciseDefinitionGuide).toBeUndefined();
      expect(s.chatGptInstruction.rules.join(" ")).not.toContain("exerciseCatalog");
    }
  });

  it("ergänzt eigene Übungen des Nutzers, gekennzeichnet", () => {
    const s = buildCoachSummary({
      ...base,
      exportPurpose: "training_plan",
      customExercises: [birdDogDef],
    });
    expect(s.exerciseCatalog).toHaveLength(21);
    expect(s.exerciseCatalog!.at(-1)).toEqual({
      id: "bird-dog",
      title: "Bird Dog",
      category: "strength",
      muscles: ["Rückenstrecker", "Großer Gesäßmuskel", "Bauchmuskeln", "Beinbeuger"],
      dose: "3 × 8 pro Seite, 2 s halten",
      custom: true,
    });
  });

  it("enthält die Kurzregeln für Übungen inkl. 3D-Bauplan", () => {
    const s = buildCoachSummary({ ...base, exportPurpose: "training_plan" });
    const rules = s.chatGptInstruction.rules.join("\n");
    expect(rules).toContain("`exercise.id` nur aus `exerciseCatalog`");
    expect(rules).toContain("exerciseDefinitionGuide");
    expect(rules).toContain('format "3d"');
  });

  it("allowCustomExercises: false lässt Bauplan und Beispiel weg", () => {
    const s = buildCoachSummary({
      ...base,
      exportPurpose: "training_plan",
      allowCustomExercises: false,
    });
    expect(coachSummarySchema.safeParse(s).success).toBe(true);
    expect(s.allowCustomExercises).toBe(false);
    expect(s.exerciseDefinitionGuide).toBeUndefined();
    expect(s.exerciseDefinitionExample).toBeUndefined();
    expect(s.chatGptInstruction.rules.join("\n")).not.toContain("exerciseDefinitionGuide");
  });

  it("das Beispiel ist eine gültige 3D-Übung ohne Fehler", () => {
    const s = buildCoachSummary({ ...base, exportPurpose: "training_plan" });
    const def = exercise3dDefinitionSchema.parse(s.exerciseDefinitionExample);
    expect(validateExercise3d(def).errors).toEqual([]);
  });
});
