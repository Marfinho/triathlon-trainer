"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "./Card";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
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
        <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-neutral-500 py-8">
              Starten Sie ein Gespräch. Ollama hat Zugriff auf Ihre Trainingsdaten.
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-neutral-900 border border-neutral-200"
                }`}
              >
                {msg.content}
              </div>
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
  );

  return lines.join("\n");
}
