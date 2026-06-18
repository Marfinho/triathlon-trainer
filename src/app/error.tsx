"use client";

import { useEffect } from "react";

/**
 * Segment-Error-Boundary: fängt Render-/Daten-Fehler im App-Bereich ab, statt
 * den Nutzer auf einen weißen Bildschirm laufen zu lassen. Zeigt eine ruhige
 * Fehlermeldung und einen Wiederholen-Button.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In Produktion landet das in der Server-/Browser-Konsole; kein PII-Leak.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">
          Etwas ist schiefgelaufen
        </h1>
        <p className="mt-2 max-w-sm text-sm text-neutral-500">
          Die Ansicht konnte nicht geladen werden. Versuche es erneut – deine
          Daten sind sicher.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-neutral-400">
            Ref: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
