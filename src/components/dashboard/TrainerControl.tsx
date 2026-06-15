"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./Card";
import {
  KickrTrainer,
  isWebBluetoothAvailable,
  type TrainerConnectionStatus,
} from "@/integrations/trainer/kickrClient";
import {
  buildWorkoutTimeline,
  stepAt,
  type TimelineSegmentInput,
} from "@/integrations/trainer/workoutPlayer";
import type { IndoorBikeData } from "@/integrations/trainer/ftms";

export interface TrainerWorkout {
  id: string;
  date: string;
  title: string;
  plannedDurationMin: number;
  segments: TimelineSegmentInput[];
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<TrainerConnectionStatus, string> = {
  disconnected: "getrennt",
  connecting: "verbinde…",
  connected: "verbunden",
  error: "Fehler",
};

const STATUS_CLS: Record<TrainerConnectionStatus, string> = {
  disconnected: "bg-slate-700 text-slate-200",
  connecting: "bg-amber-800 text-amber-100",
  connected: "bg-emerald-700 text-emerald-100",
  error: "bg-rose-800 text-rose-100",
};

export function TrainerControl({
  workouts,
  defaultFtp,
}: {
  workouts: TrainerWorkout[];
  defaultFtp: number;
}) {
  const trainerRef = useRef<KickrTrainer | null>(null);
  const elapsedRef = useRef(0);
  const offsetRef = useRef(0);

  const [available] = useState(() => isWebBluetoothAvailable());
  const [status, setStatus] = useState<TrainerConnectionStatus>("disconnected");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [ftp, setFtp] = useState(defaultFtp);
  const [selectedId, setSelectedId] = useState(workouts[0]?.id ?? "");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [offset, setOffset] = useState(0);
  const [live, setLive] = useState<IndoorBikeData>({});
  const [manualWatts, setManualWatts] = useState(150);

  // FTP aus localStorage übernehmen (überschreibt Default, falls vorhanden).
  useEffect(() => {
    const stored = window.localStorage.getItem("localhub_ftp");
    if (stored) setFtp(Number(stored) || defaultFtp);
  }, [defaultFtp]);

  useEffect(() => {
    window.localStorage.setItem("localhub_ftp", String(ftp));
  }, [ftp]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const selected = workouts.find((w) => w.id === selectedId) ?? null;
  const timeline = useMemo(
    () => buildWorkoutTimeline(selected?.segments ?? [], { ftp }),
    [selected, ftp],
  );

  const active = stepAt(timeline, elapsed);
  const currentTarget = active.step
    ? Math.max(0, active.step.targetWatts + offset)
    : 0;
  const progressPct =
    timeline.totalDurationSec > 0
      ? Math.min(100, (elapsed / timeline.totalDurationSec) * 100)
      : 0;

  // Player-Schleife: jede Sekunde Zeit hochzählen + Ziel-Watt senden.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      elapsedRef.current += 1;
      const next = elapsedRef.current;
      setElapsed(next);
      const at = stepAt(timeline, next);
      if (at.isComplete) {
        setRunning(false);
        trainerRef.current?.setTargetPower(0).catch(() => {});
        return;
      }
      if (at.step) {
        const watts = Math.max(0, at.step.targetWatts + offsetRef.current);
        trainerRef.current?.setTargetPower(watts).catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, timeline]);

  async function connect() {
    const trainer = new KickrTrainer({
      onData: (d) => setLive(d),
      onStatus: (s, msg) => {
        setStatus(s);
        setStatusMsg(msg ?? null);
        if (s === "disconnected" || s === "error") setRunning(false);
      },
    });
    trainerRef.current = trainer;
    try {
      await trainer.connect();
    } catch {
      /* Status/Fehler bereits via onStatus gesetzt */
    }
  }

  async function disconnect() {
    setRunning(false);
    await trainerRef.current?.disconnect().catch(() => {});
    trainerRef.current = null;
  }

  function startPlayer() {
    if (!selected) return;
    setRunning(true);
    const at = stepAt(timeline, elapsedRef.current);
    if (at.step) {
      trainerRef.current
        ?.setTargetPower(Math.max(0, at.step.targetWatts + offsetRef.current))
        .catch(() => {});
    }
  }

  function pausePlayer() {
    setRunning(false);
    trainerRef.current?.pause().catch(() => {});
  }

  function stopPlayer() {
    setRunning(false);
    elapsedRef.current = 0;
    setElapsed(0);
    setOffset(0);
    trainerRef.current?.setTargetPower(0).catch(() => {});
  }

  function skipStep() {
    if (!active.step) return;
    elapsedRef.current = active.step.endSec;
    setElapsed(active.step.endSec);
    const at = stepAt(timeline, active.step.endSec);
    if (at.step) {
      trainerRef.current
        ?.setTargetPower(Math.max(0, at.step.targetWatts + offsetRef.current))
        .catch(() => {});
    }
  }

  function setManual() {
    trainerRef.current?.setTargetPower(manualWatts).catch(() => {});
  }

  const connected = status === "connected";

  return (
    <Card
      title="Radrolle (Kickr Core v2)"
      subtitle="ERG-Steuerung geplanter Rad-Workouts via Bluetooth (FTMS)"
      actions={
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          {connected ? (
            <button
              onClick={disconnect}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Trennen
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={!available || status === "connecting"}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Verbinden
            </button>
          )}
        </div>
      }
    >
      {!available ? (
        <p className="mb-3 rounded-md bg-amber-950/60 px-3 py-2 text-xs text-amber-200">
          Dieser Browser unterstützt kein Web Bluetooth. Nutze Chrome oder Edge
          (Desktop) – die Seite muss über <code>localhost</code> oder HTTPS
          laufen.
        </p>
      ) : null}
      {statusMsg && status === "error" ? (
        <p className="mb-3 rounded-md bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
          {statusMsg}
        </p>
      ) : null}

      {/* Konfiguration */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          FTP (W)
          <input
            type="number"
            min={50}
            max={600}
            value={ftp}
            onChange={(e) => setFtp(Number(e.target.value) || 0)}
            className="mt-1 block w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="min-w-[14rem] flex-1 text-xs text-slate-400">
          Rad-Workout
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              elapsedRef.current = 0;
              setElapsed(0);
              setRunning(false);
            }}
            className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            {workouts.length === 0 ? (
              <option value="">— keine Rad-Workouts mit Segmenten —</option>
            ) : null}
            {workouts.map((w) => (
              <option key={w.id} value={w.id}>
                {w.date} · {w.title} ({w.plannedDurationMin}′)
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Live-Daten + Ziel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Ziel" value={`${currentTarget} W`} accent="sky" big />
        <Metric
          label="Leistung"
          value={live.instantaneousPowerW != null ? `${live.instantaneousPowerW} W` : "—"}
          accent="emerald"
          big
        />
        <Metric
          label="Trittfrequenz"
          value={
            live.instantaneousCadenceRpm != null
              ? `${Math.round(live.instantaneousCadenceRpm)} rpm`
              : "—"
          }
        />
        <Metric
          label="Herzfrequenz"
          value={live.heartRateBpm != null ? `${live.heartRateBpm} bpm` : "—"}
        />
      </div>

      {/* Schritt-Info + Fortschritt */}
      {timeline.totalDurationSec > 0 ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>
              {active.step
                ? active.step.label
                : "Workout abgeschlossen"}
            </span>
            <span>
              {active.step
                ? `${fmt(active.secondsRemainingInStep)} verbleibend · `
                : ""}
              {fmt(elapsed)} / {fmt(timeline.totalDurationSec)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 flex gap-1">
            {timeline.steps.map((s) => (
              <div
                key={s.index}
                title={`${s.label}: ${s.targetWatts} W`}
                className={`h-1.5 rounded-full ${
                  s.index === active.stepIndex ? "bg-sky-400" : "bg-slate-700"
                }`}
                style={{
                  width: `${(s.durationSec / timeline.totalDurationSec) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Das gewählte Workout hat keine zeitbasierten Segmente. Nutze die freie
          Watt-Vorgabe unten.
        </p>
      )}

      {/* Steuerung */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {running ? (
          <button
            onClick={pausePlayer}
            disabled={!connected}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={startPlayer}
            disabled={!connected || timeline.totalDurationSec === 0}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Start
          </button>
        )}
        <button
          onClick={skipStep}
          disabled={!connected || !active.step}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          Schritt überspringen
        </button>
        <button
          onClick={stopPlayer}
          disabled={!connected}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          Stop
        </button>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-xs text-slate-400">Korrektur</span>
          <OffsetButton onClick={() => setOffset((o) => o - 5)} label="−5" disabled={!connected} />
          <OffsetButton onClick={() => setOffset((o) => o + 5)} label="+5" disabled={!connected} />
          <span className="w-12 text-center text-xs text-slate-300">
            {offset >= 0 ? `+${offset}` : offset} W
          </span>
        </div>
      </div>

      {/* Freie Watt-Vorgabe (manueller ERG) */}
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-3">
        <label className="text-xs text-slate-400">
          Freie Watt-Vorgabe
          <input
            type="number"
            min={0}
            max={2000}
            value={manualWatts}
            onChange={(e) => setManualWatts(Number(e.target.value) || 0)}
            className="mt-1 block w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <button
          onClick={setManual}
          disabled={!connected || running}
          className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-40"
        >
          Watt setzen
        </button>
        <p className="text-[11px] text-slate-500">
          Setzt die Radrolle direkt auf einen festen Wert (nur bei pausiertem
          Workout).
        </p>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: "sky" | "emerald";
  big?: boolean;
}) {
  const color =
    accent === "sky"
      ? "text-sky-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : "text-slate-100";
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 font-semibold ${big ? "text-2xl" : "text-lg"} ${color}`}>
        {value}
      </p>
    </div>
  );
}

function OffsetButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-9 rounded-md border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
