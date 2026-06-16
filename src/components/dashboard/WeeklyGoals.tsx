"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, sportLabel, sportColor } from "./Card";
import type { GoalProgress } from "@/domain/training/goals";

const SPORTS = ["swim", "bike", "run", "strength"];

export function WeeklyGoals({ initial }: { initial: GoalProgress[] }) {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalProgress[]>(initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ sport: "swim", hours: 2 });

  async function reload() {
    // Fortschritt wird serverseitig berechnet -> einfacher: Seite aktualisieren.
    router.refresh();
  }

  async function saveGoal() {
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport: form.sport,
        weeklyTargetMin: Math.round(form.hours * 60),
      }),
    });
    // optimistisch ergänzen/aktualisieren
    setGoals((gs) => {
      const targetMin = Math.round(form.hours * 60);
      const existing = gs.find((g) => g.sport === form.sport);
      if (existing) {
        return gs.map((g) =>
          g.sport === form.sport
            ? { ...g, targetMin, pct: targetMin ? Math.round((g.actualMin / targetMin) * 100) : 0 }
            : g,
        );
      }
      return [...gs, { sport: form.sport, targetMin, actualMin: 0, pct: 0 }];
    });
    setEditing(false);
    reload();
  }

  async function removeGoal(sport: string) {
    setGoals((gs) => gs.filter((g) => g.sport !== sport));
    await fetch(`/api/goals?sport=${sport}`, { method: "DELETE" });
    reload();
  }

  return (
    <Card
      title="Wochenziele"
      subtitle="Zielvolumen je Disziplin vs. laufende Woche"
      actions={
        <button
          onClick={() => setEditing((e) => !e)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          {editing ? "Schließen" : "Ziel setzen"}
        </button>
      }
    >
      {editing ? (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <label className="text-xs text-neutral-500">
            Disziplin
            <select
              value={form.sport}
              onChange={(e) => setForm({ ...form, sport: e.target.value })}
              className="mt-1 block rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {sportLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-500">
            Stunden / Woche
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: Number(e.target.value) || 0 })}
              className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={saveGoal}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Speichern
          </button>
        </div>
      ) : null}

      {goals.length > 0
        ? (() => {
            const targetMin = goals.reduce((s, g) => s + g.targetMin, 0);
            const actualMin = goals.reduce((s, g) => s + g.actualMin, 0);
            const pct = targetMin ? Math.round((actualMin / targetMin) * 100) : 0;
            return (
              <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-neutral-800">Gesamt diese Woche</span>
                  <span className="text-neutral-500">
                    {(actualMin / 60).toFixed(1)} / {(targetMin / 60).toFixed(1)} h ·{" "}
                    <span className={pct >= 100 ? "font-semibold text-emerald-600" : ""}>
                      {pct}%
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: pct >= 100 ? "#34c759" : "#0a84ff",
                    }}
                  />
                </div>
              </div>
            );
          })()
        : null}

      {goals.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Noch keine Ziele gesetzt. Lege z.B. Schwimm-, Rad- und Laufstunden fest.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const color = sportColor(g.sport);
            const reached = g.pct >= 100;
            return (
              <li key={g.sport}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-neutral-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {sportLabel(g.sport)}
                  </span>
                  <span className="flex items-center gap-2 text-neutral-500">
                    <span className={reached ? "font-semibold text-emerald-600" : ""}>
                      {(g.actualMin / 60).toFixed(1)} / {(g.targetMin / 60).toFixed(1)} h
                      {!reached && g.targetMin > g.actualMin ? (
                        <span className="ml-1 text-[11px] text-neutral-400">
                          (noch {((g.targetMin - g.actualMin) / 60).toFixed(1)} h)
                        </span>
                      ) : null}
                    </span>
                    <button
                      onClick={() => removeGoal(g.sport)}
                      className="text-neutral-300 hover:text-rose-500"
                      aria-label="Ziel löschen"
                    >
                      ✕
                    </button>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, g.pct)}%`,
                      backgroundColor: reached ? "#34c759" : color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
