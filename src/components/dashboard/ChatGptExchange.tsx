"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";

const PURPOSES: { value: string; label: string }[] = [
  { value: "training_plan", label: "Trainingsplan" },
  { value: "plan_review", label: "Plan-Review" },
  { value: "week_analysis", label: "Wochenanalyse" },
  { value: "recovery_check", label: "Recovery-Check" },
  { value: "pain_check", label: "Schmerz-Check" },
  { value: "strategy_question", label: "Strategiefrage" },
  { value: "debug", label: "Debug" },
];

interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function ChatGptExchange() {
  const router = useRouter();

  // --- CoachSummary-Export ---
  const [purpose, setPurpose] = useState("training_plan");
  const [planStart, setPlanStart] = useState(tomorrowIso());
  const [planDays, setPlanDays] = useState(7);
  const [summaryJson, setSummaryJson] = useState("");
  const [copyLabel, setCopyLabel] = useState("Kopieren");
  const [exporting, setExporting] = useState(false);

  // --- Planimport ---
  const [planInput, setPlanInput] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function generateSummary() {
    setExporting(true);
    try {
      const res = await fetch("/api/coach-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportPurpose: purpose, planStart, planDays }),
      });
      const data = await res.json();
      setSummaryJson(JSON.stringify(data.summary, null, 2));
    } finally {
      setExporting(false);
    }
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryJson);
      setCopyLabel("Kopiert!");
      setTimeout(() => setCopyLabel("Kopieren"), 1500);
    } catch {
      setCopyLabel("Fehler");
    }
  }

  async function submitPlan(mode: "validate" | "import") {
    setImporting(true);
    setErrors([]);
    setInfo(null);
    try {
      const res = await fetch("/api/plan-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planInput, mode }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrors(data.errors ?? []);
        setInfo(null);
        return;
      }
      if (mode === "validate") {
        setInfo(
          `Gültig: ${data.entryCount} Einträge, ${data.replaceableCount} offene Workouts werden ersetzt, ${data.protectedCount} completed bleiben geschützt.`,
        );
      } else {
        const p = data.preview;
        let msg = `Importiert: ${p.createdCount} neu, ${p.replacedCount} ersetzt, ${p.protectedCount} geschützt.`;
        const s = data.sync;
        if (s) {
          if (s.skipped) msg += ` Intervals.icu-Sync übersprungen (${s.reason}).`;
          else if (s.error) msg += ` Intervals.icu-Sync-Fehler: ${s.error}`;
          else
            msg += ` Intervals.icu: ${s.succeeded} synchronisiert${
              s.failed ? `, ${s.failed} fehlgeschlagen` : ""
            }.`;
        }
        setInfo(msg);
        if (data.warnings?.length) {
          setErrors(data.warnings);
        }
        router.refresh();
      }
    } catch (e) {
      setErrors([
        { code: "REQUEST_FAILED", message: e instanceof Error ? e.message : "Fehler" },
      ]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card
      title="ChatGPT-Austausch"
      subtitle="CoachSummary exportieren → extern ins LLM → localhub_plan importieren"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Export */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            1 · CoachSummary exportieren
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">
              Zweck
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="mt-1 block rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                {PURPOSES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-neutral-500">
              Start
              <input
                type="date"
                value={planStart}
                onChange={(e) => setPlanStart(e.target.value)}
                className="mt-1 block rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Tage
              <input
                type="number"
                min={1}
                max={28}
                value={planDays}
                onChange={(e) => setPlanDays(Number(e.target.value))}
                className="mt-1 block w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              />
            </label>
            <button
              onClick={generateSummary}
              disabled={exporting}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {exporting ? "Erzeuge…" : "Erzeugen"}
            </button>
          </div>

          {summaryJson ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-end">
                <button
                  onClick={copySummary}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] text-neutral-700 hover:bg-neutral-100"
                >
                  {copyLabel}
                </button>
              </div>
              <textarea
                readOnly
                value={summaryJson}
                className="h-56 w-full rounded-lg border border-neutral-200 bg-white p-2 font-mono text-[11px] text-neutral-700"
              />
            </div>
          ) : null}
        </div>

        {/* Import */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            2 · localhub_plan importieren
          </h3>
          <textarea
            value={planInput}
            onChange={(e) => setPlanInput(e.target.value)}
            placeholder='localhub_plan JSON hier einfügen…'
            className="h-56 w-full rounded-lg border border-neutral-200 bg-white p-2 font-mono text-[11px] text-neutral-700"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => submitPlan("validate")}
              disabled={importing || !planInput.trim()}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
            >
              Validieren
            </button>
            <button
              onClick={() => submitPlan("import")}
              disabled={importing || !planInput.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {importing ? "…" : "Importieren"}
            </button>
          </div>

          {info ? (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {info}
            </p>
          ) : null}
          {errors.length > 0 ? (
            <ul className="mt-2 space-y-1 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono text-[10px] text-rose-500">
                    {e.code}
                    {e.path ? `@${e.path}` : ""}
                  </span>{" "}
                  {e.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
