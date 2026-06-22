"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBarcodeScannerEngine } from "@/lib/barcode/detector";
import type { BarcodeEngine } from "@/lib/barcode/types";
import { isSupportedEan, normalizeBarcode } from "@/domain/barcode/format";
import { INITIAL_STABILIZER_STATE, stabilize, type StabilizerState } from "@/domain/barcode/stabilizer";

export type BarcodeScannerStatus = "idle" | "starting" | "scanning" | "detected" | "error";

interface UseBarcodeScannerOptions {
  onDetected: (ean: string) => void;
}

interface UseBarcodeScannerResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  status: BarcodeScannerStatus;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Orchestriert Engine-Auswahl, Stabilisierung und Cleanup für den
 * Barcode-Scanner. Die Komponente muss nur `containerRef` rendern und
 * `start()`/`stop()` an Mount/Unmount hängen.
 */
export function useBarcodeScanner({ onDetected }: UseBarcodeScannerOptions): UseBarcodeScannerResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BarcodeEngine | null>(null);
  const stabilizerRef = useRef<StabilizerState>(INITIAL_STABILIZER_STATE);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState<BarcodeScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stop = useCallback(async () => {
    const engine = engineRef.current;
    engineRef.current = null;
    if (engine) {
      try {
        await engine.stop();
      } catch {
        // best effort – Stream ist beim Unmount ggf. schon weg
      }
    }
  }, []);

  const start = useCallback(async () => {
    if (!containerRef.current) return;
    setStatus("starting");
    setErrorMessage(null);
    stabilizerRef.current = INITIAL_STABILIZER_STATE;
    detectedRef.current = false;

    if (typeof window === "undefined" || !window.isSecureContext) {
      setStatus("error");
      setErrorMessage("Kamera-Zugriff erfordert eine sichere Verbindung (HTTPS bzw. localhost).");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage("Dieser Browser unterstützt keinen Kamerazugriff.");
      return;
    }

    try {
      const engine = await createBarcodeScannerEngine();
      engineRef.current = engine;
      await engine.start(containerRef.current, {
        onResult: ({ code }) => {
          if (detectedRef.current) return;
          const normalized = normalizeBarcode(code);
          if (!isSupportedEan(normalized)) return;

          const { state, accepted } = stabilize(stabilizerRef.current, normalized, Date.now());
          stabilizerRef.current = state;
          if (accepted) {
            detectedRef.current = true;
            setStatus("detected");
            void stop();
            onDetectedRef.current(accepted);
          }
        },
        onError: (err) => {
          setStatus("error");
          setErrorMessage(err.message || "Scanner-Fehler.");
        },
      });
      setStatus((prev) => (prev === "starting" ? "scanning" : prev));
    } catch (err) {
      setStatus("error");
      setErrorMessage(mapStartError(err));
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return { containerRef, status, errorMessage, start, stop };
}

function mapStartError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "Kamera-Zugriff wurde verweigert.";
    if (err.name === "NotFoundError") return "Keine Kamera gefunden.";
    if (err.name === "NotReadableError") return "Kamera ist bereits in Verwendung.";
  }
  return "Scanner konnte nicht gestartet werden.";
}
