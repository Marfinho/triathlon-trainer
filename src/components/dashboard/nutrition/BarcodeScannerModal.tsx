"use client";

import { useEffect } from "react";
import { useBarcodeScanner, type BarcodeScannerStatus } from "@/hooks/useBarcodeScanner";

const STATUS_LABEL: Record<BarcodeScannerStatus, string> = {
  idle: "Bereit…",
  starting: "Kamera wird gestartet…",
  scanning: "Halte den Barcode in den Rahmen.",
  detected: "Barcode erkannt.",
  error: "Scanner nicht verfügbar.",
};

/**
 * Mobil-optimiertes Modal (Bottom-Sheet auf kleinen Screens, zentriert ab
 * `sm`) für den kamerabasierten EAN-Scan. Reine UI-Orchestrierung – die
 * eigentliche Scanner-Logik lebt in `useBarcodeScanner`.
 */
export function BarcodeScannerModal({
  onDetected,
  onClose,
}: {
  onDetected: (ean: string) => void;
  onClose: () => void;
}) {
  const { containerRef, status, errorMessage, start, stop } = useBarcodeScanner({ onDetected });

  useEffect(() => {
    void start();
    return () => {
      void stop();
    };
    // Nur beim Mount starten / beim Unmount stoppen – `start`/`stop` sind stabil (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Barcode scannen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 p-4">
          <h3 className="text-sm font-semibold text-neutral-900">Barcode scannen</h3>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>

        <div className="relative aspect-[3/4] w-full bg-neutral-900 sm:aspect-square">
          <div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden" />
          {status === "scanning" || status === "starting" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
              <div className="h-28 w-full max-w-xs rounded-xl border-2 border-white/80" />
            </div>
          ) : null}
        </div>

        <div className="p-4 text-center">
          {status === "error" ? (
            <p className="text-sm font-medium text-rose-600" role="alert">
              {errorMessage ?? "Scanner nicht verfügbar."}
            </p>
          ) : (
            <p className="text-sm text-neutral-600">{STATUS_LABEL[status]}</p>
          )}
          <button
            onClick={onClose}
            className="mt-3 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 sm:w-auto"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
