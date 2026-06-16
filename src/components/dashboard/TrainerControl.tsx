"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import { Sparkline } from "@/components/charts/Charts";
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
import {
  summarizeRide,
  downsample,
  type RideSample,
  type RideSummary,
} from "@/integrations/trainer/recording";
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
  disconnected: "bg-neutral-200 text-neutral-600",
  connecting: "bg-amber-100 text-amber-700",
  connected: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
};

export function TrainerControl({
  workouts,
  defaultFtp,
}: {
  workouts: TrainerWorkout[];
  defaultFtp: number;
}) {
  const router = useRouter();
  const trainerRef = useRef<KickrTrainer | null>(null);
  const elapsedRef = useRef(0);
  const offsetRef = useRef(0);
  const liveRef = useRef<IndoorBikeData>({});
  const samplesRef = useRef<RideSample[]>([]);
  const recSecRef = useRef(0);
  const targetRef = useRef(0);

  const [available] = useState(() => isWebBluetoothAvailable());
  const [status, setStatus] = useState<TrainerConnectionStatus>("disconnected");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [ftp, setFtp] = useState(defaultFtp);
  const [selectedId, setSelectedId] = useState(workouts[0]?.id ?? "");
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [offset, setOffset] = useState(0);
  const [live, setLive] = useState<IndoorBikeData>({});
  const [manualWatts, setManualWatts] = useState(150);

  const [summary, setSummary] = useState<RideSummary | null>(null);
  const [summarySamples, setSummarySamples] = useState<RideSample[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

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
  targetRef.current = currentTarget;
  const progressPct =
    timeline.totalDurationSec > 0
      ? Math.min(100, (elapsed / timeline.totalDurationSec) * 100)
      : 0;

  const finalizeRecording = useCallback(() => {
    setRecording(false);
    const samples = samplesRef.current;
    if (samples.length > 0) {
      setSummary(summarizeRide(samples, { ftp }));
      setSummarySamples(samples);
    }
  }, [ftp]);

  const startRecording = useCallback(() => {
    samplesRef.current = [];
    recSecRef.current = 0;
    setSummary(null);
    setSavedMsg(null);
    setRecording(true);
  }, []);

  // Aufzeichnung: jede Sekunde ein Sample aus den letzten Live-Daten.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const l = liveRef.current;
      samplesRef.current.push({
        tSec: recSecRef.current,
        powerW: l.instantaneousPowerW ?? null,
        cadenceRpm: l.instantaneousCadenceRpm ?? null,
        hrBpm: l.heartRateBpm ?? null,
        speedKmh: l.instantaneousSpeedKmh ?? null,
        targetW: targetRef.current,
      });
      recSecRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  // Player: Zeit hochzählen + Ziel-Watt senden, am Ende automatisch beenden.
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
        finalizeRecording();
        return;
      }
      if (at.step) {
        const watts = Math.max(0, at.step.targetWatts + offsetRef.current);
        trainerRef.current?.setTargetPower(watts).catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, timeline, finalizeRecording]);

  async function connect() {
    const trainer = new KickrTrainer({
      onData: (d) => {
        liveRef.current = d;
        setLive(d);
      },
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
      /* Status via onStatus */
    }
  }

  async function disconnect() {
    setRunning(false);
    if (recording) finalizeRecording();
    await trainerRef.current?.disconnect().catch(() => {});
    trainerRef.current = null;
  }

  function startPlayer() {
    if (!selected) return;
    setRunning(true);
    if (!recording) startRecording();
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
    if (recording) finalizeRecording();
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

  async function saveActivity() {
    if (!summary) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: "bike",
          source: "trainer",
          date: new Date().toISOString(),
          durationMin: Math.round((summary.durationSec / 60) * 10) / 10,
          distanceKm: summary.distanceKm ?? undefined,
          load: summary.tss ?? undefined,
          avgHr: summary.avgHrBpm ?? undefined,
          notes: selected ? `Radrolle: ${selected.title}` : "Radrolle (frei)",
          samples: downsample(summarySamples, 300),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSavedMsg("Als Aktivität gespeichert.");
        setSummary(null);
        router.refresh();
      } else {
        setSavedMsg(data.error ?? "Speichern fehlgeschlagen.");
      }
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  const connected = status === "connected";
  const powerSeries = useMemo(
    () => downsample(summarySamples, 120).map((s) => s.powerW ?? null),
    [summarySamples],
  );

  return (
    <Card
      title="Radrolle (Kickr Core v2)"
      subtitle="ERG-Steuerung & Aufzeichnung geplanter Rad-Workouts via Bluetooth (FTMS)"
      actions={
        <div className="flex items-center gap-2">
          {recording ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              REC {fmt(recSecRef.current)}
            </span>
          ) : null}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          {connected ? (
            <button
              onClick={disconnect}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Trennen
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={!available || status === "connecting"}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Verbinden
            </button>
          )}
        </div>
      }
    >
      {!available ? (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Dieser Browser unterstützt kein Web Bluetooth. Nutze Chrome oder Edge
          (Desktop) über <code>localhost</code> oder HTTPS.
        </p>
      ) : null}
      {statusMsg && status === "error" ? (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {statusMsg}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-neutral-500">
          FTP (W)
          <input
            type="number"
            min={50}
            max={600}
            value={ftp}
            onChange={(e) => setFtp(Number(e.target.value) || 0)}
            className="mt-1 block w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </label>
        <label className="min-w-[14rem] flex-1 text-xs text-neutral-500">
          Rad-Workout
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              elapsedRef.current = 0;
              setElapsed(0);
              setRunning(false);
            }}
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
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

      {timeline.totalDurationSec > 0 ? (
        <WorkoutProfile
          steps={timeline.steps}
          total={timeline.totalDurationSec}
          ftp={ftp}
          activeIndex={active.stepIndex}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Ziel" value={`${currentTarget} W`} accent="blue" big />
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

      {timeline.totalDurationSec > 0 ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
            <span>{active.step ? active.step.label : "Workout abgeschlossen"}</span>
            <span>
              {active.step ? `${fmt(active.secondsRemainingInStep)} verbleibend · ` : ""}
              {fmt(elapsed)} / {fmt(timeline.totalDurationSec)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 flex gap-1">
            {timeline.steps.map((s) => (
              <div
                key={s.index}
                title={`${s.label}: ${s.targetWatts} W`}
                className={`h-1.5 rounded-full ${
                  s.index === active.stepIndex ? "bg-blue-400" : "bg-neutral-200"
                }`}
                style={{ width: `${(s.durationSec / timeline.totalDurationSec) * 100}%` }}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-neutral-400">
          Das gewählte Workout hat keine zeitbasierten Segmente. Nutze die freie
          Watt-Vorgabe unten.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {running ? (
          <button
            onClick={pausePlayer}
            disabled={!connected}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-400 disabled:opacity-40"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={startPlayer}
            disabled={!connected || timeline.totalDurationSec === 0}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Start
          </button>
        )}
        <button
          onClick={skipStep}
          disabled={!connected || !active.step}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
        >
          Schritt überspringen
        </button>
        <button
          onClick={stopPlayer}
          disabled={!connected}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
        >
          Stop
        </button>
        <button
          onClick={() => (recording ? finalizeRecording() : startRecording())}
          disabled={!connected}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
        >
          {recording ? "Aufzeichnung beenden" : "Frei aufzeichnen"}
        </button>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-xs text-neutral-500">Korrektur</span>
          <OffsetButton onClick={() => setOffset((o) => o - 5)} label="−5" disabled={!connected} />
          <OffsetButton onClick={() => setOffset((o) => o + 5)} label="+5" disabled={!connected} />
          <span className="w-12 text-center text-xs text-neutral-600">
            {offset >= 0 ? `+${offset}` : offset} W
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-neutral-200 pt-3">
        <label className="text-xs text-neutral-500">
          Freie Watt-Vorgabe
          <input
            type="number"
            min={0}
            max={2000}
            value={manualWatts}
            onChange={(e) => setManualWatts(Number(e.target.value) || 0)}
            className="mt-1 block w-28 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          />
        </label>
        <button
          onClick={setManual}
          disabled={!connected || running}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          Watt setzen
        </button>
        <p className="text-[11px] text-neutral-400">
          Setzt die Radrolle direkt auf einen festen Wert (bei pausiertem Workout).
        </p>
      </div>

      {/* Zusammenfassung der aufgezeichneten Einheit */}
      {summary ? (
        <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-800">
              Aufgezeichnete Einheit
            </h3>
            <span className="text-xs text-neutral-500">{fmt(summary.durationSec)}</span>
          </div>
          <div className="mb-3 text-blue-600">
            <Sparkline values={powerSeries} color="#0a84ff" height={48} />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Metric label="Ø Power" value={summary.avgPowerW != null ? `${summary.avgPowerW} W` : "—"} />
            <Metric label="NP" value={summary.normalizedPowerW != null ? `${summary.normalizedPowerW} W` : "—"} />
            <Metric label="IF" value={summary.intensityFactor != null ? summary.intensityFactor.toFixed(2) : "—"} />
            <Metric label="TSS" value={summary.tss != null ? `${summary.tss}` : "—"} />
            <Metric label="kJ" value={summary.kiloJoules != null ? `${summary.kiloJoules}` : "—"} />
            <Metric label="Ø HF" value={summary.avgHrBpm != null ? `${summary.avgHrBpm}` : "—"} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={saveActivity}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {saving ? "Speichere…" : "Als Aktivität speichern"}
            </button>
            <button
              onClick={() => setSummary(null)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Verwerfen
            </button>
          </div>
        </div>
      ) : null}
      {savedMsg ? (
        <p className="mt-3 text-xs text-emerald-600">{savedMsg}</p>
      ) : null}
    </Card>
  );
}

function zoneColor(ratio: number): string {
  if (ratio < 0.6) return "#0a84ff";
  if (ratio < 0.9) return "#30b0c7";
  if (ratio < 1.05) return "#34c759";
  if (ratio < 1.2) return "#ff9f0a";
  return "#ff3b30";
}

function WorkoutProfile({
  steps,
  total,
  ftp,
  activeIndex,
}: {
  steps: { index: number; durationSec: number; targetWatts: number }[];
  total: number;
  ftp: number;
  activeIndex: number;
}) {
  const maxW = Math.max(ftp * 1.2, ...steps.map((s) => s.targetWatts), 1);
  return (
    <div className="mb-4">
      <div className="flex h-16 items-end gap-px overflow-hidden rounded-lg bg-neutral-50 p-1">
        {steps.map((s) => {
          const ratio = ftp > 0 ? s.targetWatts / ftp : 0;
          return (
            <div
              key={s.index}
              title={`${s.targetWatts} W · ${Math.round(s.durationSec / 60)}′`}
              className="flex h-full shrink-0 items-end"
              style={{ width: `${(s.durationSec / total) * 100}%` }}
            >
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${Math.max(4, (s.targetWatts / maxW) * 100)}%`,
                  backgroundColor: zoneColor(ratio),
                  opacity: s.index === activeIndex ? 1 : 0.55,
                }}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-neutral-400">
        Workout-Profil · Ziel-Watt je Segment
      </p>
    </div>
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
  accent?: "blue" | "emerald";
  big?: boolean;
}) {
  const color =
    accent === "blue"
      ? "text-blue-600"
      : accent === "emerald"
        ? "text-emerald-600"
        : "text-neutral-900";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`mt-0.5 font-semibold ${big ? "text-2xl" : "text-base"} ${color}`}>
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
      className="h-7 w-9 rounded-lg border border-neutral-300 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
