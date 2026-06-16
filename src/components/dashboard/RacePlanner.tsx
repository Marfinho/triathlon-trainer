"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import {
  daysUntilRace,
  describeCountdown,
  racePosition,
  trainingPhase,
} from "@/domain/training/races";

export interface Race {
  id: string;
  name: string;
  date: string; // ISO
  type: string;
  distance: string | null;
  priority: string | null;
  notes: string | null;
}

const HORIZON_DAYS = 182;

const PRIORITY_CLS: Record<string, string> = {
  A: "bg-rose-100 text-rose-700",
  B: "bg-amber-100 text-amber-700",
  C: "bg-neutral-100 text-neutral-600",
};

const PRIORITY_DOT: Record<string, string> = {
  A: "#ff3b30",
  B: "#ff9f0a",
  C: "#8e8e93",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function RacePlanner({ initialRaces }: { initialRaces: Race[] }) {
  const router = useRouter();
  const [races, setRaces] = useState<Race[]>(initialRaces);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    type: "triathlon",
    distance: "",
    priority: "A",
  });

  const today = new Date();
  const enriched = useMemo(
    () =>
      races
        .map((r) => ({ race: r, days: daysUntilRace(r.date, today) }))
        .sort((a, b) => a.days - b.days),
    [races],
  );
  const upcoming = enriched.filter((e) => e.days >= 0);
  const nextA = upcoming.find((e) => e.race.priority === "A") ?? upcoming[0];
  const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
  for (const e of upcoming) counts[e.race.priority ?? "C"] = (counts[e.race.priority ?? "C"] ?? 0) + 1;

  async function addRace() {
    if (!form.name.trim() || !form.date) return;
    setBusy(true);
    try {
      const res = await fetch("/api/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setRaces((r) => [...r, data.race]);
        setForm({ name: "", date: "", type: "triathlon", distance: "", priority: "A" });
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeRace(id: string) {
    setRaces((r) => r.filter((x) => x.id !== id));
    await fetch(`/api/races/${id}`, { method: "DELETE" }).catch(() => {});
    router.refresh();
  }

  return (
    <Card
      title="Wettkämpfe & Saison"
      subtitle="Countdown, Priorität und Saison-Timeline"
      actions={
        <div className="flex items-center gap-2">
          {(["A", "B", "C"] as const).map((p) =>
            counts[p] ? (
              <span
                key={p}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CLS[p]}`}
                title={`${counts[p]} kommende ${p}-Rennen`}
              >
                {p} {counts[p]}
              </span>
            ) : null,
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            {open ? "Schließen" : "Rennen hinzufügen"}
          </button>
        </div>
      }
    >
      {nextA ? (
        <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                Nächstes Hauptrennen
              </p>
              <p className="mt-0.5 text-lg font-semibold text-neutral-900">
                {nextA.race.name}
              </p>
              <p className="text-xs text-neutral-500">
                {fmtDate(nextA.race.date)}
                {nextA.race.distance ? ` · ${nextA.race.distance}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-blue-600">
                {nextA.days}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                Tage · {Math.round(nextA.days / 7)} Wo
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-neutral-200 pt-2">
            <span className="text-[11px] uppercase tracking-wide text-neutral-400">
              Phase
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              {trainingPhase(nextA.days).label}
            </span>
          </div>
        </div>
      ) : null}

      {/* Saison-Timeline */}
      <div className="mb-5">
        <div className="mb-1 flex justify-between text-[11px] text-neutral-400">
          <span>heute</span>
          <span>+6 Monate</span>
        </div>
        <div className="relative h-10 rounded-lg bg-neutral-100">
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-neutral-200" />
          {enriched.map(({ race, days }) => {
            const pos = racePosition(days, HORIZON_DAYS);
            if (!pos.withinHorizon) return null;
            return (
              <div
                key={race.id}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.fraction * 100}%` }}
                title={`${race.name} · ${fmtDate(race.date)}`}
              >
                <div
                  className="h-3 w-3 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: PRIORITY_DOT[race.priority ?? "C"] }}
                />
                <span className="pointer-events-none absolute left-1/2 top-4 hidden -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                  {race.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {open ? (
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-3">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="col-span-2 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm sm:col-span-1"
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="triathlon">Triathlon</option>
            <option value="run">Lauf</option>
            <option value="bike">Rad</option>
            <option value="swim">Schwimmen</option>
          </select>
          <input
            placeholder="Distanz (z.B. 70.3)"
            value={form.distance}
            onChange={(e) => setForm({ ...form, distance: e.target.value })}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="A">Priorität A</option>
            <option value="B">Priorität B</option>
            <option value="C">Priorität C</option>
          </select>
          <button
            onClick={addRace}
            disabled={busy || !form.name.trim() || !form.date}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      ) : null}

      {enriched.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Noch keine Wettkämpfe angelegt.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {enriched.map(({ race, days }) => (
            <li key={race.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    PRIORITY_CLS[race.priority ?? "C"]
                  }`}
                >
                  {race.priority ?? "C"}
                </span>
                <div>
                  <p className="text-sm font-medium text-neutral-900">{race.name}</p>
                  <p className="text-xs text-neutral-500">
                    {fmtDate(race.date)}
                    {race.distance ? ` · ${race.distance}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">
                  {describeCountdown(days)}
                </span>
                <button
                  onClick={() => removeRace(race.id)}
                  className="text-neutral-300 hover:text-rose-500"
                  aria-label="Rennen löschen"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
