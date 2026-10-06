"use client";

import { useEffect, useRef } from "react";
import type { LiveSnapshot } from "@/lib/live-session";

const SEND_INTERVAL_MS = 1000;
const HEARTBEAT_MS = 5000;

function post(snapshot: LiveSnapshot) {
  return fetch("/api/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Veröffentlicht den Live-Zustand einer Einheit für die TV-Ansicht
 * (`/trainer/tv`). `snapshot === null` heißt: keine aktive Einheit.
 * Gesendet wird höchstens einmal pro Sekunde bei Änderung, sonst als
 * Heartbeat alle 5 s; beim Beenden/Verlassen der Seite folgt `idle`.
 */
export function useLivePublisher(snapshot: LiveSnapshot | null) {
  const latest = useRef<LiveSnapshot | null>(snapshot);
  latest.current = snapshot;
  const active = snapshot !== null;

  useEffect(() => {
    if (!active) return;
    let lastJson = "";
    let lastSent = 0;
    const tick = () => {
      const s = latest.current;
      if (!s) return;
      const json = JSON.stringify(s);
      const now = Date.now();
      if (json !== lastJson || now - lastSent >= HEARTBEAT_MS) {
        lastJson = json;
        lastSent = now;
        void post(s);
      }
    };
    tick();
    const id = window.setInterval(tick, SEND_INTERVAL_MS);
    const onHide = () => void post({ kind: "idle" });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", onHide);
      void post({ kind: "idle" });
    };
  }, [active]);
}
