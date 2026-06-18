import { describe, it, expect } from "vitest";
import { suggestNutritionTargets, buildDefaultChecklist } from "@/domain/training/nutrition";

describe("suggestNutritionTargets", () => {
  it("liefert moderate Werte für kurze Einheiten", () => {
    const t = suggestNutritionTargets(45);
    expect(t.carbsGPerHour).toBe(30);
    expect(t.caffeineMg).toBe(0);
  });

  it("liefert mittlere Werte für 60-150 Minuten", () => {
    const t = suggestNutritionTargets(120);
    expect(t.carbsGPerHour).toBe(60);
    expect(t.fluidMlPerHour).toBe(600);
  });

  it("liefert hohe Werte für Langdistanz", () => {
    const t = suggestNutritionTargets(300);
    expect(t.carbsGPerHour).toBe(90);
    expect(t.sodiumMgPerHour).toBe(700);
    expect(t.caffeineMg).toBe(100);
  });

  it("Grenzwerte gehören zur niedrigeren Kategorie", () => {
    expect(suggestNutritionTargets(60).carbsGPerHour).toBe(30);
    expect(suggestNutritionTargets(150).carbsGPerHour).toBe(60);
  });
});

describe("buildDefaultChecklist", () => {
  it("liefert eine triathlon-spezifische Checkliste inkl. allgemeiner Punkte", () => {
    const list = buildDefaultChecklist("triathlon");
    expect(list.some((i) => i.label.includes("Neoprenanzug"))).toBe(true);
    expect(list.some((i) => i.label.includes("Startunterlagen"))).toBe(true);
    expect(list.every((i) => i.done === false)).toBe(true);
  });

  it("fällt für unbekannte Typen auf triathlon zurück", () => {
    const list = buildDefaultChecklist("unknown-type");
    expect(list.length).toBeGreaterThan(0);
  });

  it("liefert für run eine andere Liste als für swim", () => {
    const run = buildDefaultChecklist("run").map((i) => i.label);
    const swim = buildDefaultChecklist("swim").map((i) => i.label);
    expect(run).not.toEqual(swim);
  });
});
