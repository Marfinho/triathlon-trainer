/**
 * Optionale direkte LLM-Anbindung (Anthropic/OpenAI) als Alternative zum
 * manuellen Copy-Paste-Workflow im ChatGPT-Austausch. Aktiv, sobald der
 * Betreiber ANTHROPIC_API_KEY oder OPENAI_API_KEY gesetzt hat (Anthropic hat
 * Vorrang, falls beide gesetzt sind). Ohne API-Key bleibt der bisherige
 * manuelle Workflow unverändert nutzbar.
 */

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic-API-Fehler (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { content?: AnthropicContentBlock[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

async function callOpenAi(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI-API-Fehler (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Schickt den Prompt an den konfigurierten Anbieter (Anthropic bevorzugt). */
export async function callLlm(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return callAnthropic(prompt);
  if (process.env.OPENAI_API_KEY) return callOpenAi(prompt);
  throw new Error("Keine LLM-API konfiguriert (ANTHROPIC_API_KEY oder OPENAI_API_KEY fehlt).");
}
