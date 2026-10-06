/**
 * Live-Zustand einer laufenden Einheit (Rolle / Kraft) für Zweitbildschirme
 * wie den Apple TV. Das Gerät, das die Einheit steuert (Handy/Laptop mit
 * Bluetooth), veröffentlicht regelmäßig einen Snapshot; die TV-Ansicht
 * abonniert ihn per Server-Sent Events.
 *
 * Der Zustand liegt nur im Arbeitsspeicher (flüchtig, pro Nutzer ein Snapshot).
 * Das passt zum Single-Container-Betrieb; bei mehreren Instanzen müsste hier
 * ein gemeinsamer Store (z. B. Postgres LISTEN/NOTIFY) dahinter.
 */
import { z } from "zod";

const text = (max: number) => z.string().max(max);
const num = z.number().finite();

const bikeSchema = z.object({
  kind: z.literal("bike"),
  title: text(120),
  running: z.boolean(),
  elapsedSec: num.min(0).max(86_400),
  totalSec: num.min(0).max(86_400),
  ftp: num.min(0).max(2000),
  offsetW: num.min(-1000).max(1000),
  powerW: num.min(0).max(5000).nullable(),
  cadenceRpm: num.min(0).max(300).nullable(),
  hrBpm: num.min(0).max(300).nullable(),
  speedKmh: num.min(0).max(200).nullable(),
  step: z
    .object({
      index: num.int().min(0).max(1000),
      count: num.int().min(0).max(1000),
      label: text(160),
      targetW: num.min(0).max(5000),
      remainingSec: num.min(0).max(86_400),
    })
    .nullable(),
  next: z
    .object({ label: text(160), targetW: num.min(0).max(5000), durationSec: num.min(0).max(86_400) })
    .nullable(),
  /** Workout-Profil: Dauer + Ziel-Watt je Schritt. */
  profile: z
    .array(z.object({ d: num.min(0).max(86_400), w: num.min(0).max(5000) }))
    .max(300),
});

const strengthSchema = z.object({
  kind: z.literal("strength"),
  title: text(120),
  stepIndex: num.int().min(0).max(1000),
  stepCount: num.int().min(0).max(1000),
  finished: z.boolean(),
  exercise: z
    .object({
      title: text(160),
      dose: text(160),
      note: text(300).nullable(),
      set: num.int().min(0).max(100),
      sets: num.int().min(0).max(100),
      side: z.union([z.literal(1), z.literal(2)]).nullable(),
      phase: z.enum(["ready", "hold", "rest", "stepDone", "text"]),
      countdownSec: num.min(0).max(36_000).nullable(),
    })
    .nullable(),
  next: text(160).nullable(),
});

export const liveSnapshotSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("idle") }),
  bikeSchema,
  strengthSchema,
]);

export type LiveSnapshot = z.infer<typeof liveSnapshotSchema>;
export type LiveEvent = { snapshot: LiveSnapshot; updatedAt: number };

/** Ohne neuen Snapshot gilt eine Einheit nach dieser Zeit als beendet. */
export const LIVE_STALE_MS = 20_000;

type Listener = (event: LiveEvent) => void;
interface Store {
  current: Map<string, LiveEvent>;
  listeners: Map<string, Set<Listener>>;
}

const g = globalThis as unknown as { __liveSessions?: Store };
const store: Store = (g.__liveSessions ??= { current: new Map(), listeners: new Map() });

export function publishLive(userId: string, snapshot: LiveSnapshot, now = Date.now()): LiveEvent {
  const event: LiveEvent = { snapshot, updatedAt: now };
  if (snapshot.kind === "idle") store.current.delete(userId);
  else store.current.set(userId, event);
  for (const l of store.listeners.get(userId) ?? []) l(event);
  return event;
}

/** Aktueller Snapshot; veraltete Einträge werden als idle behandelt. */
export function getLive(userId: string, now = Date.now()): LiveEvent {
  const e = store.current.get(userId);
  if (!e || now - e.updatedAt > LIVE_STALE_MS) {
    return { snapshot: { kind: "idle" }, updatedAt: now };
  }
  return e;
}

export function subscribeLive(userId: string, listener: Listener): () => void {
  let set = store.listeners.get(userId);
  if (!set) store.listeners.set(userId, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) store.listeners.delete(userId);
  };
}
