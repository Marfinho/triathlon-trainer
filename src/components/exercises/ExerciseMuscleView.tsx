import { renderHeroSvg } from "@/domain/exercises/engine";
import type { ExerciseDefinition } from "@/domain/exercises/schema";
import { ExerciseFigure } from "./ExerciseFigure";

const LEVEL_LABEL = { 1: "Hauptarbeit", 2: "unterstützend" } as const;

/** Muskelbild (Endpose) mit nummerierter Legende. */
export function ExerciseMuscleView({ definition }: { definition: ExerciseDefinition }) {
  return (
    <section aria-label="Zielmuskeln">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Zielmuskeln</h3>
      <ExerciseFigure svg={renderHeroSvg(definition)} />
      <ol className="mt-3 space-y-2">
        {definition.muscles.map((m, i) => (
          <li key={m.key} className="flex gap-2.5 text-sm leading-snug">
            <span className={`exfig-num ${m.kind === "stretch" ? "stretch" : ""}`} aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <span className="sr-only">{i + 1}. </span>
              <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{m.label}</strong>
              <span className="ml-1.5 inline-block rounded-full bg-neutral-100 px-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {m.kind === "stretch" ? "wird gedehnt" : LEVEL_LABEL[m.level]}
              </span>
              <span className="block text-neutral-600 dark:text-neutral-400">{m.note}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Farblegende (rot = arbeitet, blau = wird gedehnt, blass = unterstützt). */
export function ExerciseLegend() {
  return (
    <div
      aria-label="Legende"
      className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-400"
    >
      <span className="inline-flex items-center gap-1.5">
        <i className="exfig-swatch work" /> arbeitet
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="exfig-swatch stretch" /> wird gedehnt
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="exfig-swatch soft" /> unterstützt
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="exfig-swatch ghost" /> blasse Figur: Ausgangsposition
      </span>
    </div>
  );
}
