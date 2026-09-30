"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import {
  cssFromTimeTrials,
  paceToSpeed,
  parseClock,
  formatClock,
} from "@/domain/training/calculators";

export function TrainingCalculators() {
  const router = useRouter();
  const [t400, setT400] = useState("6:00");
  const [t200, setT200] = useState("2:50");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [pace, setPace] = useState("5:00");

  const s400 = parseClock(t400);
  const s200 = parseClock(t200);
  const css = s400 != null && s200 != null ? cssFromTimeTrials(s400, s200) : null;

  const paceSec = parseClock(pace);
  const speed = paceSec != null ? paceToSpeed(paceSec) : null;

  async function saveCss() {
    if (css == null) return;
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thresholdSwimPer100m: Math.round(css) }),
    });
    setSavedMsg("CSS ins Profil übernommen.");
    setTimeout(() => setSavedMsg(null), 1500);
    router.refresh();
  }

  return (
    <Card title="Rechner" subtitle="CSS-Test & Pace-Umrechnung">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            CSS (Schwimmen)
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-500">
              400 m
              <input
                value={t400}
                onChange={(e) => setT400(e.target.value)}
                className="mt-1 block w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-500">
              200 m
              <input
                value={t200}
                onChange={(e) => setT200(e.target.value)}
                className="mt-1 block w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <p className="mt-3 text-sm text-neutral-700">
            CSS-Pace:{" "}
            <span className="font-semibold text-neutral-900">
              {css != null ? `${formatClock(css)} /100m` : "—"}
            </span>
          </p>
          <button
            onClick={saveCss}
            disabled={css == null}
            className="mt-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
          >
            Ins Profil übernehmen
          </button>
          {savedMsg ? (
            <p className="mt-1 text-xs text-emerald-600">{savedMsg}</p>
          ) : null}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Pace ↔ Geschwindigkeit
          </h3>
          <label className="text-xs text-neutral-500">
            Pace (min/km)
            <input
              value={pace}
              onChange={(e) => setPace(e.target.value)}
              className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <p className="mt-3 text-sm text-neutral-700">
            Geschwindigkeit:{" "}
            <span className="font-semibold text-neutral-900">
              {speed != null ? `${speed} km/h` : "—"}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}
