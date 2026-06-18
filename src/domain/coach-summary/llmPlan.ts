import type { CoachSummary } from "@/domain/schemas";

/**
 * Baut aus einer coach_summary den vollständigen Prompt für eine direkte
 * LLM-API-Anfrage – inhaltlich identisch zu dem, was der Nutzer beim
 * manuellen Copy-Paste-Workflow selbst ins Chatfenster einfügen würde.
 */
export function buildLlmPrompt(summary: CoachSummary): string {
  const instruction = summary.chatGptInstruction;
  return [
    instruction.role,
    instruction.outputFormat,
    "",
    "Regeln:",
    ...instruction.rules.map((r) => `- ${r}`),
    "",
    "Kontext (coach_summary JSON):",
    JSON.stringify(summary, null, 2),
  ].join("\n");
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** Sucht das erste vollständige {...}-Objekt ab der ersten "{" (string-aware). */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Extrahiert ein JSON-Objekt aus einer LLM-Antwort – versucht direktes
 * Parsen, dann einen Markdown-Codeblock, dann das erste vollständige
 * {...}-Objekt im Text (für Antworten mit zusätzlicher Prosa trotz Anweisung,
 * ausschließlich JSON zu antworten).
 */
export function extractPlanJson(text: string): unknown | null {
  const direct = tryParseJson(text.trim());
  if (direct !== undefined) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParseJson(fenced[1].trim());
    if (parsed !== undefined) return parsed;
  }

  const balanced = extractBalancedObject(text);
  if (balanced) {
    const parsed = tryParseJson(balanced);
    if (parsed !== undefined) return parsed;
  }

  return null;
}
