/**
 * EIN globaler requestAnimationFrame-Loop für alle Übungs-Animationen einer
 * Seite. Aktualisiert nur Player, die spielen UND sichtbar sind
 * (IntersectionObserver). Läuft der Tab im Hintergrund, ruht der Loop.
 */
export interface AnimationClient {
  /** true = soll in diesem Frame weiterlaufen */
  isActive(): boolean;
  /** Zeit fortschreiben (Sekunden, bereits auf 0,1 s begrenzt) */
  advance(dt: number): void;
}

const clients = new Set<AnimationClient>();
let rafId: number | null = null;
let last = 0;
let visibilityBound = false;

function frame(ts: number) {
  const dt = Math.min((ts - last) / 1000, 0.1);
  last = ts;
  clients.forEach((c) => {
    if (c.isActive()) c.advance(dt);
  });
  rafId = clients.size > 0 ? requestAnimationFrame(frame) : null;
}

function start() {
  if (rafId !== null || typeof requestAnimationFrame !== "function") return;
  if (typeof document !== "undefined" && document.hidden) return;
  rafId = requestAnimationFrame((t) => {
    last = t;
    rafId = requestAnimationFrame(frame);
  });
}

function stop() {
  if (rafId !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
  rafId = null;
}

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (clients.size > 0) start();
  });
}

export function registerAnimation(client: AnimationClient): () => void {
  clients.add(client);
  bindVisibility();
  start();
  return () => {
    clients.delete(client);
    if (clients.size === 0) stop();
  };
}
