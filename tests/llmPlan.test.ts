import { describe, it, expect } from "vitest";
import { buildLlmPrompt, extractPlanJson } from "@/domain/coach-summary/llmPlan";
import type { CoachSummary } from "@/domain/schemas";

const summary: CoachSummary = {
  schemaVersion: "1.0",
  type: "coach_summary",
  generatedAt: "2026-06-17T00:00:00.000Z",
  athleteId: null,
  exportPurpose: "training_plan",
  requestedOutput: {
    format: "localhub_plan_json",
    planStart: "2026-06-18",
    planDays: 7,
    language: "de",
    timezone: "Europe/Berlin",
  },
  includedModules: ["athlete_profile"],
  modules: { athlete_profile: { ftpWatts: 250 } },
  chatGptInstruction: {
    role: "Du bist mein Triathlon-Coach.",
    outputFormat: "Antworte ausschließlich mit einem gültigen JSON-Objekt.",
    rules: ["Regel A", "Regel B"],
  },
};

describe("buildLlmPrompt", () => {
  it("enthält Rolle, Regeln und die coach_summary als JSON", () => {
    const prompt = buildLlmPrompt(summary);
    expect(prompt).toContain("Du bist mein Triathlon-Coach.");
    expect(prompt).toContain("- Regel A");
    expect(prompt).toContain("- Regel B");
    expect(prompt).toContain('"exportPurpose": "training_plan"');
  });
});

describe("extractPlanJson", () => {
  it("parsed eine direkte JSON-Antwort", () => {
    const text = '{"type":"localhub_plan","planDays":7}';
    expect(extractPlanJson(text)).toEqual({ type: "localhub_plan", planDays: 7 });
  });

  it("parsed JSON aus einem Markdown-Codeblock", () => {
    const text = 'Hier ist dein Plan:\n```json\n{"type":"localhub_plan"}\n```\nViel Erfolg!';
    expect(extractPlanJson(text)).toEqual({ type: "localhub_plan" });
  });

  it("findet das erste vollständige Objekt trotz umgebender Prosa", () => {
    const text = 'Klar, hier ist er: {"type":"localhub_plan","entries":[{"date":"2026-06-18"}]} Ich hoffe das passt.';
    expect(extractPlanJson(text)).toEqual({
      type: "localhub_plan",
      entries: [{ date: "2026-06-18" }],
    });
  });

  it("ignoriert geschweifte Klammern innerhalb von Strings beim Zählen", () => {
    const text = '{"type":"localhub_plan","note":"Enthält { und } im Text"}';
    expect(extractPlanJson(text)).toEqual({
      type: "localhub_plan",
      note: "Enthält { und } im Text",
    });
  });

  it("liefert null ohne extrahierbares JSON", () => {
    expect(extractPlanJson("Das ist nur Fließtext ohne JSON.")).toBeNull();
  });
});
