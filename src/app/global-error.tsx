"use client";

/**
 * Globale Error-Boundary (ersetzt das Root-Layout, wenn dieses selbst crasht).
 * Bewusst minimal und ohne externe Abhängigkeiten.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#07070D",
          color: "#F1F1FB",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>
            Unerwarteter Fehler
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#9A9AB8", fontSize: "0.875rem" }}>
            Bitte lade die Seite neu.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              borderRadius: "0.5rem",
              background: "#00E5FF",
              color: "#07070D",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
