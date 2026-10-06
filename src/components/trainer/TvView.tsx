"use client";

import { useEffect, useState } from "react";
import type { LiveEvent, LiveSnapshot } from "@/lib/live-session";

type Bike = Extract<LiveSnapshot, { kind: "bike" }>;
type Strength = Extract<LiveSnapshot, { kind: "strength" }>;

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
}

function zoneColor(watts: number, ftp: number): string {
  const r = ftp > 0 ? watts / ftp : 0;
  if (r < 0.56) return "#64748b";
  if (r < 0.76) return "#38bdf8";
  if (r < 0.91) return "#4ade80";
  if (r < 1.06) return "#facc15";
  if (r < 1.21) return "#fb923c";
  return "#f87171";
}

/** Abonniert /api/live/stream; verbindet bei Abbruch automatisch neu (EventSource). */
function useLive(): { event: LiveEvent | null; connected: boolean } {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const es = new EventSource("/api/live/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      try {
        setEvent(JSON.parse(m.data) as LiveEvent);
        setConnected(true);
      } catch {
        // kaputtes Paket ignorieren
      }
    };
    return () => es.close();
  }, []);
  return { event, connected };
}

export function TvView() {
  const { event, connected } = useLive();
  const snap = event?.snapshot;
  return (
    <main className="fixed inset-0 overflow-hidden bg-neutral-950 p-[3vw] text-white">
      {snap?.kind === "bike" ? (
        <BikeScreen s={snap} />
      ) : snap?.kind === "strength" ? (
        <StrengthScreen s={snap} />
      ) : (
        <Waiting connected={connected} />
      )}
    </main>
  );
}

function Waiting({ connected }: { connected: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-[4vw] font-bold">{connected ? "Warte auf Training…" : "Verbinde…"}</p>
      <p className="max-w-[60vw] text-[1.8vw] text-neutral-400">
        Starte eine Einheit auf deinem Handy oder Laptop (Rollentrainer verbinden oder
        Kraft-Einheit öffnen) – sie erscheint hier automatisch.
      </p>
    </div>
  );
}

function Header({ title, right }: { title: string; right: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 text-[2vw] text-neutral-400">
      <span className="truncate font-semibold text-neutral-200">{title}</span>
      <span className="tabular-nums">{right}</span>
    </div>
  );
}

function Progress({ pct }: { pct: number }) {
  return (
    <div className="h-[1vw] w-full overflow-hidden rounded-full bg-neutral-800">
      <div
        className="h-full rounded-full bg-blue-500 transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function Big({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="rounded-3xl bg-neutral-900 px-[2vw] py-[1.5vw]">
      <p className="text-[1.6vw] uppercase tracking-widest text-neutral-400">{label}</p>
      <p
        className="mt-[0.5vw] text-[8vw] font-bold leading-none tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
        {unit ? <span className="ml-[0.8vw] text-[2.4vw] font-medium text-neutral-400">{unit}</span> : null}
      </p>
    </div>
  );
}

function BikeScreen({ s }: { s: Bike }) {
  const total = s.totalSec;
  const target = s.step?.targetW ?? null;
  const power = s.powerW;
  // Abweichung vom Ziel: ±5 % grün, sonst amber/rot.
  const dev = target && target > 0 && power != null ? Math.abs(power - target) / target : null;
  const powerColor = dev == null ? undefined : dev <= 0.05 ? "#4ade80" : dev <= 0.15 ? "#facc15" : "#f87171";

  return (
    <div className="flex h-full flex-col gap-[1.5vw]">
      <Header
        title={s.title}
        right={`${fmt(s.elapsedSec)}${total > 0 ? ` / ${fmt(total)}` : ""}${s.running ? "" : " · pausiert"}`}
      />
      <Progress pct={total > 0 ? (s.elapsedSec / total) * 100 : 0} />

      <div className="grid flex-1 grid-cols-[1.6fr_1fr] gap-[1.5vw]">
        <div className="flex flex-col gap-[1.5vw]">
          <div className="flex-1 rounded-3xl bg-neutral-900 px-[2.5vw] py-[2vw]">
            <p className="text-[1.6vw] uppercase tracking-widest text-neutral-400">Leistung</p>
            <p
              className="mt-[0.5vw] text-[15vw] font-bold leading-none tabular-nums"
              style={powerColor ? { color: powerColor } : undefined}
            >
              {power != null ? Math.round(power) : "–"}
              <span className="ml-[1vw] text-[3vw] font-medium text-neutral-400">W</span>
            </p>
            {target != null ? (
              <p className="mt-[1vw] text-[3vw] text-neutral-300">
                Ziel <span className="font-bold tabular-nums text-white">{Math.round(target)} W</span>
                {s.offsetW !== 0 ? (
                  <span className="ml-[1vw] text-[2vw] text-neutral-400">
                    ({s.offsetW > 0 ? "+" : ""}
                    {s.offsetW} W)
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <Profile s={s} />
        </div>

        <div className="flex flex-col gap-[1.5vw]">
          <Big label="Herzfrequenz" value={s.hrBpm != null ? String(Math.round(s.hrBpm)) : "–"} unit="bpm" />
          <Big
            label="Trittfrequenz"
            value={s.cadenceRpm != null ? String(Math.round(s.cadenceRpm)) : "–"}
            unit="rpm"
          />
          <div className="flex-1 rounded-3xl bg-neutral-900 px-[2vw] py-[1.5vw]">
            {s.step ? (
              <>
                <p className="text-[1.6vw] uppercase tracking-widest text-neutral-400">
                  Schritt {s.step.index + 1}/{s.step.count}
                </p>
                <p className="mt-[0.5vw] text-[7vw] font-bold leading-none tabular-nums">
                  {fmt(s.step.remainingSec)}
                </p>
                <p className="mt-[1vw] truncate text-[1.8vw] text-neutral-300">{s.step.label}</p>
                {s.next ? (
                  <p className="mt-[1vw] truncate text-[1.8vw] text-neutral-400">
                    Danach: <span className="font-semibold text-neutral-200">{Math.round(s.next.targetW)} W</span>{" "}
                    · {fmt(s.next.durationSec)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-[2.6vw] text-neutral-300">
                {total > 0 && s.elapsedSec >= total ? "Workout geschafft!" : "Freie Fahrt"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Workout-Profil als Balken (Dauer × Ziel-Watt) mit Positionsmarke. */
function Profile({ s }: { s: Bike }) {
  const total = s.profile.reduce((a, p) => a + p.d, 0);
  if (total <= 0) return null;
  const max = Math.max(s.ftp * 1.3, ...s.profile.map((p) => p.w), 1);
  let cursor = 0;
  return (
    <div className="relative h-[11vw] rounded-3xl bg-neutral-900 p-[1.2vw]">
      <div className="relative flex h-full items-end">
        {s.profile.map((p, i) => {
          const left = (cursor / total) * 100;
          cursor += p.d;
          return (
            <div
              key={i}
              className="absolute bottom-0 rounded-t-sm"
              style={{
                left: `${left}%`,
                width: `${(p.d / total) * 100}%`,
                height: `${Math.max(2, (p.w / max) * 100)}%`,
                background: zoneColor(p.w, s.ftp),
                opacity: s.step && i === s.step.index ? 1 : 0.45,
              }}
            />
          );
        })}
        <div
          className="absolute bottom-0 top-0 w-[0.25vw] bg-white"
          style={{ left: `${Math.min(100, (s.elapsedSec / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  ready: "Bereit",
  hold: "Halten",
  rest: "Pause",
  stepDone: "Übung erledigt",
  text: "",
};

function StrengthScreen({ s }: { s: Strength }) {
  const pct = s.finished ? 100 : (s.stepIndex / Math.max(1, s.stepCount)) * 100;
  if (s.finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-[7vw] font-bold text-emerald-400">Einheit geschafft!</p>
        <p className="text-[2.4vw] text-neutral-400">{s.title}</p>
      </div>
    );
  }
  const e = s.exercise;
  const countdown = e?.countdownSec ?? null;
  return (
    <div className="flex h-full flex-col gap-[1.5vw]">
      <Header title={s.title} right={`Schritt ${s.stepIndex + 1} von ${s.stepCount}`} />
      <Progress pct={pct} />
      <div className="grid flex-1 grid-cols-[1.4fr_1fr] gap-[1.5vw]">
        <div className="flex flex-col justify-center rounded-3xl bg-neutral-900 px-[3vw] py-[2vw]">
          <p className="text-[6vw] font-bold leading-tight">{e?.title ?? "–"}</p>
          {e?.dose ? <p className="mt-[1vw] text-[3vw] text-neutral-300">{e.dose}</p> : null}
          {e?.note ? (
            <p className="mt-[2vw] rounded-2xl bg-amber-950/60 px-[1.5vw] py-[1vw] text-[2vw] text-amber-200">
              {e.note}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-[1.5vw]">
          <div className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-neutral-900 px-[2vw] text-center">
            {e && e.sets > 0 ? (
              <p className="text-[2.6vw] text-neutral-300">
                Satz <span className="font-bold text-white">{e.set}</span> von {e.sets}
                {e.side ? ` · Seite ${e.side}` : ""}
              </p>
            ) : null}
            {countdown != null ? (
              <p
                className={`mt-[1vw] text-[14vw] font-bold leading-none tabular-nums ${
                  e?.phase === "rest" ? "text-sky-300" : "text-emerald-300"
                }`}
              >
                {fmt(countdown)}
              </p>
            ) : null}
            {e?.phase && PHASE_LABEL[e.phase] ? (
              <p className="mt-[1vw] text-[3vw] font-semibold text-neutral-200">{PHASE_LABEL[e.phase]}</p>
            ) : null}
          </div>
          {s.next ? (
            <div className="rounded-3xl bg-neutral-900 px-[2vw] py-[1.5vw]">
              <p className="text-[1.5vw] uppercase tracking-widest text-neutral-400">Als Nächstes</p>
              <p className="mt-[0.5vw] truncate text-[2.4vw] font-semibold">{s.next}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
