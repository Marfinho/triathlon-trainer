import { renderFaultSvg } from "@/domain/exercises/engine";
import type { ExerciseDefinition } from "@/domain/exercises/schema";
import { ExerciseAnimation } from "./ExerciseAnimation";
import { ExerciseFigure } from "./ExerciseFigure";
import { ExerciseMuscleView } from "./ExerciseMuscleView";
import { ExerciseStrip } from "./ExerciseStrip";

export const CATEGORY_LABEL: Record<ExerciseDefinition["category"], string> = {
  strength: "Kraft",
  mobility: "Mobility",
};

/**
 * Vollständige Übungsansicht: Titel, Muskelbild, Animation, Ablauf,
 * „So geht es", „Typische Fehler" (mit Fehlerbild) und Richtwert.
 */
export function ExerciseDetail({
  definition,
  custom = false,
}: {
  definition: ExerciseDefinition;
  custom?: boolean;
}) {
  const fault = renderFaultSvg(definition);
  return (
    <article className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {definition.title}
        </h2>
        <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{definition.subtitle}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {CATEGORY_LABEL[definition.category]}
          </span>
          {custom ? (
            <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              Eigene Übung
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <ExerciseMuscleView definition={definition} />
        <div>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Animation</h3>
          <ExerciseAnimation definition={definition} />
        </div>
      </div>

      <ExerciseStrip definition={definition} />

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-3 text-sm text-neutral-800 dark:text-neutral-200">{definition.why}</p>
          <h3 className="mb-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">So geht es</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-800 dark:text-neutral-200">
            {definition.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          {definition.mistakes.length > 0 || fault ? (
            <>
              <h3 className="mb-1.5 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Typische Fehler
              </h3>
              {fault ? (
                <figure className="mb-3 max-w-[300px]">
                  <ExerciseFigure svg={fault} />
                  <figcaption className="mt-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">
                    ✗ {definition.faultCaption}
                  </figcaption>
                </figure>
              ) : null}
              <ul className="space-y-1 text-sm text-neutral-800 dark:text-neutral-200">
                {definition.mistakes.map((m, i) => (
                  <li key={i} className="relative pl-5">
                    <span aria-hidden="true" className="absolute left-0 font-bold text-rose-600 dark:text-rose-400">
                      ✗
                    </span>
                    {m}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-l-4 border-neutral-200 border-l-blue-600 bg-white px-3 py-2.5 text-sm dark:border-neutral-800 dark:border-l-blue-400 dark:bg-neutral-900">
            <dt className="font-semibold text-neutral-900 dark:text-neutral-100">Richtwert</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{definition.dose}</dd>
            <dt className="font-semibold text-neutral-900 dark:text-neutral-100">Anpassen</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{definition.progression}</dd>
          </dl>
        </div>
      </div>
    </article>
  );
}
