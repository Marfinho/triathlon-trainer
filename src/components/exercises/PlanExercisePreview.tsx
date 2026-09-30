import { ExerciseFigure, ExercisePlaceholder } from "./ExerciseFigure";

export interface PlanExerciseSummaryView {
  used: string[];
  segmentCount: number;
  custom: { id: string; title: string; valid: boolean }[];
}

export interface CustomExercisePreviewView {
  index: number;
  id: string | null;
  title: string | null;
  valid: boolean;
  error: string | null;
  /** Engine-Ausgabe vom Server (XML-escaped) */
  startSvg: string | null;
  endSvg: string | null;
}

/**
 * Import-Vorschau der Übungen: Anzahl der Übungssegmente und je eigene
 * Definition Start- und Endbild mit Status gültig/ungültig.
 */
export function PlanExercisePreview({
  summary,
  customPreviews,
}: {
  summary: PlanExerciseSummaryView | null;
  customPreviews: CustomExercisePreviewView[];
}) {
  if ((!summary || summary.segmentCount === 0) && customPreviews.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      {summary ? (
        <p className="text-xs text-neutral-700 dark:text-neutral-300">
          <span className="font-semibold">{summary.segmentCount}</span> Übungssegmente,{" "}
          {summary.used.length} verschiedene Übungen
          {summary.custom.length > 0 ? `, davon ${summary.custom.length} eigene` : ""}.
        </p>
      ) : null}
      {customPreviews.length > 0 ? (
        <ul className="mt-2 space-y-3">
          {customPreviews.map((c) => (
            <li key={c.index} className="text-xs">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {c.title ?? "(ohne Titel)"}
                </span>
                <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400">{c.id ?? "?"}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    c.valid
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  }`}
                >
                  {c.valid ? "gültig" : "ungültig"}
                </span>
              </p>
              {c.error ? <p className="mt-0.5 text-rose-700 dark:text-rose-300">{c.error}</p> : null}
              <div className="mt-1.5 grid max-w-sm grid-cols-2 gap-2">
                {c.startSvg ? <ExerciseFigure svg={c.startSvg} /> : <ExercisePlaceholder id={c.id ?? "?"} reason="invalid" />}
                {c.endSvg ? <ExerciseFigure svg={c.endSvg} /> : <ExercisePlaceholder id={c.id ?? "?"} reason="invalid" />}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
