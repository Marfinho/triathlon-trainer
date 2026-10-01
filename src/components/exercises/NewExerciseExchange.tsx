"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExerciseFigure } from "./ExerciseFigure";

interface Issue {
  code: string;
  message: string;
  path?: string;
}

interface Preview {
  id: string;
  title: string;
  subtitle: string;
  heroSvg: string;
  muscles: { label: string; role: string }[];
  frames: { label: string; svg: string }[];
  fault: { svg: string; caption: string } | null;
}

const ROLE_LABEL: Record<string, string> = {
  work: "arbeitet",
  support: "unterstützt",
  stretch: "wird gedehnt",
  stabilize: "stabilisiert",
};

/**
 * „Neue Übung mit KI“: 1. Wunsch eingeben und Prompt kopieren, 2. Antwort der
 * KI einfügen und prüfen lassen, 3. Vorschau ansehen und erst dann mit
 * „Übung übernehmen“ speichern. Die Vorschau-Bilder sind Engine-Ausgabe vom
 * Server; Texte der KI werden als normaler React-Text (escaped) angezeigt.
 */
export function NewExerciseExchange({ promptTemplate, placeholder }: { promptTemplate: string; placeholder: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState("");
  const [copyLabel, setCopyLabel] = useState("Prompt kopieren");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Issue[]>([]);
  const [warnings, setWarnings] = useState<Issue[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const prompt = promptTemplate.replace(placeholder, () => wish.trim() || "(bitte hier beschreiben)");

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyLabel("Kopiert ✓");
    } catch {
      setCopyLabel("Kopieren nicht möglich – Text unten markieren");
    }
    setTimeout(() => setCopyLabel("Prompt kopieren"), 2500);
  }

  async function send(mode: "validate" | "save") {
    setBusy(true);
    setSaved(null);
    try {
      const res = await fetch("/api/exercises/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ definition: answer, mode }),
      });
      const data = await res.json();
      if (mode === "save") {
        if (data.ok) {
          setSaved(data.id);
          setErrors([]);
          router.refresh();
        } else setErrors(data.errors ?? [{ code: "ERROR", message: "Speichern fehlgeschlagen." }]);
      } else {
        setErrors(data.errors ?? []);
        setWarnings(data.warnings ?? []);
        setPreview(data.preview ?? null);
      }
    } catch {
      setErrors([{ code: "NETWORK", message: "Server nicht erreichbar." }]);
    } finally {
      setBusy(false);
    }
  }

  // Fehlerliste als Text zum Zurückgeben an die KI
  const feedback =
    errors.length > 0
      ? `Die App meldet folgende Fehler. Korrigiere genau diese Werte und gib die vollständige Übung erneut als JSON aus:\n${errors
          .map((e) => `- ${e.code} ${e.path ?? ""}: ${e.message}`)
          .join("\n")}`
      : "";

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
      >
        + Neue Übung mit KI
      </button>
    );

  return (
    <section aria-label="Neue Übung mit KI" className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Neue Übung mit KI</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500 hover:text-neutral-800">
          Schließen
        </button>
      </div>

      <ol className="mt-3 space-y-5">
        <li>
          <h3 className="text-sm font-semibold text-neutral-900">1 · Wunsch beschreiben und Prompt kopieren</h3>
          <label className="mt-2 block text-sm text-neutral-600" htmlFor="new-exercise-wish">
            Was soll die Übung trainieren? (z. B. „Wadendehnung an der Wand“)
          </label>
          <textarea
            id="new-exercise-wish"
            value={wish}
            maxLength={1000}
            onChange={(e) => setWish(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyPrompt}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {copyLabel}
            </button>
            <span className="text-xs text-neutral-500">Der Prompt enthält den 3D-Bauplan und ein Beispiel ({Math.round(prompt.length / 1000)} k Zeichen).</span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-neutral-500">Prompt anzeigen</summary>
            <textarea readOnly value={prompt} rows={8} className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px] text-neutral-700" />
          </details>
        </li>

        <li>
          <h3 className="text-sm font-semibold text-neutral-900">2 · Antwort der KI einfügen und prüfen</h3>
          <textarea
            aria-label="Antwort der KI (JSON)"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setPreview(null);
              setSaved(null);
            }}
            rows={6}
            placeholder='{ "format": "3d", "id": "…", … }'
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs text-neutral-900"
          />
          <button
            type="button"
            disabled={busy || answer.trim().length === 0}
            onClick={() => send("validate")}
            className="mt-2 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Prüfe…" : "Prüfen"}
          </button>
          {errors.length > 0 ? (
            <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="font-semibold">Noch nicht übernehmbar – {errors.length} Fehler:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {errors.map((e, i) => (
                  <li key={i}>
                    {e.path ? <code className="text-xs">{e.path}</code> : null} {e.message}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(feedback).catch(() => {})}
                className="mt-2 text-sm font-semibold text-rose-800 underline-offset-2 hover:underline"
              >
                Fehler für die KI kopieren
              </button>
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-800">
              {warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          ) : null}
        </li>

        {preview ? (
          <li>
            <h3 className="text-sm font-semibold text-neutral-900">3 · Vorschau ansehen und übernehmen</h3>
            <p className="mt-1 text-sm text-neutral-800">
              <strong>{preview.title}</strong> – {preview.subtitle}
            </p>
            <div className="mt-2 grid gap-3 md:grid-cols-[2fr_3fr]">
              <div>
                <ExerciseFigure svg={preview.heroSvg} />
                <ol className="mt-2 space-y-0.5 text-xs text-neutral-700">
                  {preview.muscles.map((m, i) => (
                    <li key={i}>
                      {i + 1}. {m.label} – {ROLE_LABEL[m.role] ?? m.role}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {preview.frames.map((f, i) => (
                  <figure key={i} className="m-0">
                    <ExerciseFigure svg={f.svg} />
                    <figcaption className="mt-1 text-xs text-neutral-700">
                      {i + 1}. {f.label}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
            {preview.fault ? (
              <figure className="mt-3 max-w-[260px]">
                <ExerciseFigure svg={preview.fault.svg} />
                <figcaption className="mt-1 text-xs font-semibold text-rose-700">✗ {preview.fault.caption}</figcaption>
              </figure>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy || errors.length > 0}
                onClick={() => send("save")}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Übung übernehmen
              </button>
              {errors.length > 0 ? <span className="text-xs text-neutral-500">Erst die Fehler beheben.</span> : null}
              {saved ? (
                <Link href={`/trainer/uebungen/${saved}`} className="text-sm font-semibold text-emerald-700 hover:underline">
                  Gespeichert ✓ – Übung öffnen
                </Link>
              ) : null}
            </div>
          </li>
        ) : null}
      </ol>
    </section>
  );
}
