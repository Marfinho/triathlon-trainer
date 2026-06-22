import type { BarcodeEngine, BarcodeEngineCallbacks } from "./types";
import type { BarcodeDetectorInstance } from "./feature-detection";

/**
 * Scanner-Engine auf Basis der nativen `BarcodeDetector`-API. Verwaltet
 * eigenen `<video>`-Tag + `getUserMedia`-Stream und pollt per
 * `requestAnimationFrame`. Wird nur verwendet, wenn `detectBarcodeSupport()`
 * native Unterstützung für `ean_13` gemeldet hat.
 */
export function createNativeBarcodeEngine(): BarcodeEngine {
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let detector: BarcodeDetectorInstance | null = null;
  let rafId: number | null = null;
  let stopped = false;

  function scheduleNext(callbacks: BarcodeEngineCallbacks) {
    if (stopped) return;
    rafId = requestAnimationFrame(() => void tick(callbacks));
  }

  async function tick(callbacks: BarcodeEngineCallbacks) {
    if (stopped || !video || !detector || video.readyState < video.HAVE_CURRENT_DATA) {
      scheduleNext(callbacks);
      return;
    }
    try {
      const results = await detector.detect(video);
      const hit = results.find((r) => r.format === "ean_13" || r.format === "ean_8");
      if (hit) callbacks.onResult({ code: hit.rawValue });
    } catch {
      // Einzelne fehlgeschlagene Frames sind normal (z.B. Bewegungsunschärfe) – kein Fehlerfall.
    }
    scheduleNext(callbacks);
  }

  return {
    kind: "native",
    async start(container, callbacks) {
      stopped = false;
      const BarcodeDetectorCtor = window.BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        throw new Error("BarcodeDetector ist in diesem Browser nicht verfügbar.");
      }
      detector = new BarcodeDetectorCtor({ formats: ["ean_13", "ean_8"] });

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      video = document.createElement("video");
      video.setAttribute("playsinline", "true");
      video.setAttribute("muted", "true");
      video.muted = true;
      video.autoplay = true;
      video.className = "h-full w-full object-cover";
      video.srcObject = stream;
      container.replaceChildren(video);
      await video.play();

      scheduleNext(callbacks);
    },
    async stop() {
      stopped = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        stream = null;
      }
      if (video) {
        video.pause();
        video.srcObject = null;
        video.remove();
        video = null;
      }
      detector = null;
    },
  };
}
