"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "./Card";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  planUpdates?: Array<{
    action: string;
    date?: string;
    sport?: string;
    title?: string;
    workoutId?: string;
    synced?: boolean;
    error?: string;
  }>;
}

export interface OllamaChatProps {
  athleteName: string;
  contextData: {
    weight?: number | null;
    restingHr?: number | null;
    hrv?: number | null;
    recentActivities?: Array<{ date: string; sport: string; durationMin: number }>;
    thisWeekLoad?: number;
    formStatus?: string;
  };
}

export function OllamaChat({ athleteName, contextData }: OllamaChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setError(null);

    try {
      const systemPrompt = buildSystemPrompt(athleteName, contextData);

      const res = await fetch("/api/integrations/ollama/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          system: systemPrompt,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Fehler bei der Anfrage.");
        return;
      }

      const response = data.response;
      let planUpdates = undefined;

      // Check if response contains plan update instructions (JSON block)
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          const updateData = JSON.parse(jsonMatch[1]);
          if (updateData.updates && Array.isArray(updateData.updates)) {
            // Apply plan updates
            const updateRes = await fetch(
              "/api/integrations/ollama/plan-update",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
              },
            );

            const updateResult = await updateRes.json();
            if (updateResult.ok) {
              planUpdates = updateResult.updates;
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response, planUpdates },
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Netzwerkfehler.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Ollama Coach" subtitle="Direkter Austausch mit deinem lokalen LLM">
      <div className="flex flex-col gap-4 h-full">
        {messages.length === 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
            💡 Du kannst den Trainer fragen, deinen Plan anzupassen. Beispiel: "Füge einen 10er Lauf für Mittwoch ein" oder "Verkürze das Sonntags-Bike auf 90 Minuten". Ollama wird die Änderungen automatisch zu Intervals.icu synchronisieren.
          </div>
        )}
        <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-neutral-500 py-8">
              Starten Sie ein Gespräch. Ollama hat Zugriff auf Ihre Trainingsdaten.
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className="space-y-2">
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-neutral-900 border border-neutral-200"
                  }`}
                >
                  {/* Remove JSON block from display */}
                  {msg.content.replace(/```json\n?[\s\S]*?\n?```/g, "").trim()}
                </div>
              </div>
              {msg.planUpdates && msg.planUpdates.length > 0 && (
                <div className="pl-3 border-l-2 border-emerald-500 space-y-1">
                  <p className="text-xs font-semibold text-emerald-700">
                    Plan aktualisiert:
                  </p>
                  {msg.planUpdates.map((update, i) => (
                    <div
                      key={i}
                      className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded"
                    >
                      {update.action === "create" && (
                        <>
                          ✓ {update.date}: {update.sport} ({update.title})
                          {update.synced && " → Intervals.icu"}
                        </>
                      )}
                      {update.action === "update" && (
                        <>
                          ✓ Training aktualisiert
                          {update.synced && " → Intervals.icu"}
                        </>
                      )}
                      {update.action === "delete" && <>✓ Training gelöscht</>}
                      {update.error && (
                        <span className="text-red-600">Fehler: {update.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white text-neutral-900 border border-neutral-200 px-3 py-2 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Frage zu deinem Training…"
            disabled={loading}
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-neutral-300 disabled:cursor-not-allowed"
          >
            {loading ? "…" : "Senden"}
          </button>
        </div>
      </div>
    </Card>
  );
}

function buildSystemPrompt(athleteName: string, contextData: OllamaChatProps["contextData"]): string {
  const lines = [
    `Du bist ein kompetenter Trainingsberater für einen Triathleten namens ${athleteName}.`,
    `Du sprichst Deutsch und gibst konkrete, praktische Ratschläge.`,
    `Du hast Zugriff auf folgende Daten über ${athleteName}:`,
  ];

  if (contextData.weight) {
    lines.push(`- Körpergewicht: ${contextData.weight.toFixed(1)} kg`);
  }
  if (contextData.restingHr) {
    lines.push(`- Ruhepuls: ${contextData.restingHr} bpm`);
  }
  if (contextData.hrv) {
    lines.push(`- HRV: ${contextData.hrv}`);
  }
  if (contextData.thisWeekLoad) {
    lines.push(`- Trainingsbelastung diese Woche: ${contextData.thisWeekLoad.toFixed(0)}`);
  }
  if (contextData.formStatus) {
    lines.push(`- Trainingsform: ${contextData.formStatus}`);
  }
  if (contextData.recentActivities && contextData.recentActivities.length > 0) {
    lines.push(`- Letzte Aktivitäten:`);
    contextData.recentActivities.slice(0, 5).forEach((act) => {
      lines.push(`  - ${act.date}: ${act.sport} (${act.durationMin} min)`);
    });
  }

  lines.push(
    `\nBeantworte Fragen zum Training von ${athleteName} auf Basis dieser Daten.`,
    `Gib konkrete, umsetzbare Tipps und beziehe dich auf die verfügbaren Daten.`,
    `\n## Plan-Änderungen`,
    `Falls der Nutzer dich auffordert, den Trainingsplan anzupassen, antworte normal UND`,
    `füge am Ende deiner Nachricht einen JSON-Block hinzu mit folgendem Format:`,
    ``,
    `\`\`\`json`,
    `{`,
    `  "updates": [`,
    `    {`,
    `      "action": "create",`,
    `      "date": "YYYY-MM-DD",`,
    `      "sport": "run|bike|swim|brick|strength|mobility|walk|other",`,
    `      "title": "Kurzbeschreibung",`,
    `      "plannedDurationMin": 60,`,
    `      "description": "Optionale Details"`,
    `    }`,
    `  ]`,
    `}`,
    `\`\`\``,
    `\nMögliche Actions: "create", "update" (mit workoutId), "delete" (mit workoutId)`,
    `Der JSON wird automatisch verarbeitet und zu Intervals.icu synchronisiert.`,
  );

  return lines.join("\n");
}
