import { ARROW_MARKER_DEFS } from "@/domain/exercises/engine";

/**
 * Rendert einen von der Figuren-Engine erzeugten SVG-String.
 *
 * SICHERHEIT: `dangerouslySetInnerHTML` ist hier NUR für Engine-Ausgabe
 * zulässig (reine Zahlen + XML-escapte Texte, siehe engine/escape.ts). Niemals
 * Nutzer- oder LLM-Text direkt übergeben.
 */
export function ExerciseFigure({
  svg,
  className = "",
  framed = true,
}: {
  svg: string;
  className?: string;
  framed?: boolean;
}) {
  return (
    <div
      className={`exfig ${framed ? "exfig-pane" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Pfeilspitze `#ah` – einmal pro Seite einbinden, auf der Figuren erscheinen. */
export function ExerciseSvgDefs() {
  return (
    <svg
      className="exfig"
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs dangerouslySetInnerHTML={{ __html: ARROW_MARKER_DEFS }} />
    </svg>
  );
}

/** Platzhalter, wenn eine (eigene) Übung fehlt oder ungültig ist. */
export function ExercisePlaceholder({ id, reason }: { id: string; reason: "missing" | "invalid" }) {
  return (
    <div
      role="img"
      aria-label={`Übung ${id}: keine Abbildung verfügbar`}
      className="flex aspect-[200/170] w-full items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-2 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-400"
    >
      {reason === "invalid" ? "Übung ungültig" : "Übung unbekannt"}
    </div>
  );
}
