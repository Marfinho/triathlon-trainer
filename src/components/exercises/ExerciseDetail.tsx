import { isExercise3d, renderFaultAny, type AnyExerciseDefinition } from "@/domain/exercises/any";
import { ExerciseAnimation } from "./ExerciseAnimation";
import { Exercise3dViewer } from "./Exercise3dViewer";
import { Exercise3dStill } from "./Exercise3dStill";
import { ExerciseFigure } from "./ExerciseFigure";
import { ExerciseMuscleView } from "./ExerciseMuscleView";
import { ExerciseStrip } from "./ExerciseStrip";

export const CATEGORY_LABEL: Record<AnyExerciseDefinition["category"], string> = {
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
  definition: AnyExerciseDefinition;
  custom?: boolean;
}) {
  const fault = renderFaultAny(definition);
  return (
    <article className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {definition.title}
        </h2>
        <p className="mt-0.5 text-sm text-neutral-600">{definition.subtitle}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
            {CATEGORY_LABEL[definition.category]}
          </span>
          {custom ? (
            <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              Eigene Übung
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <ExerciseMuscleView definition={definition} />
        <div>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">
            {isExercise3d(definition) ? "Animation in 3D" : "Animation"}
          </h3>
          {isExercise3d(definition) ? (
            <Exercise3dViewer definition={definition} />
          ) : (
            <ExerciseAnimation definition={definition} />
          )}
        </div>
      </div>

      <ExerciseStrip definition={definition} />

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-3 text-sm text-neutral-800">{definition.why}</p>
          <h3 className="mb-1.5 text-sm font-semibold text-neutral-900">So geht es</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-800">
            {definition.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          {definition.mistakes.length > 0 || fault ? (
            <>
              <h3 className="mb-1.5 text-sm font-semibold text-neutral-900">
                Typische Fehler
              </h3>
              {fault ? (
                <figure className="mb-3 max-w-[300px]">
                  {isExercise3d(definition) ? (
                    <Exercise3dStill
                      definition={definition}
                      spec={{ kind: "fault" }}
                      svg={fault.svg}
                      label={`Häufiger Fehler bei ${definition.title}`}
                    />
                  ) : (
                    <ExerciseFigure svg={fault.svg} />
                  )}
                  <figcaption className="mt-1.5 text-sm font-semibold text-rose-700">
                    ✗ {fault.caption}
                  </figcaption>
                </figure>
              ) : null}
              <ul className="space-y-1 text-sm text-neutral-800">
                {definition.mistakes.map((m, i) => (
                  <li key={i} className="relative pl-5">
                    <span aria-hidden="true" className="absolute left-0 font-bold text-rose-600">
                      ✗
                    </span>
                    {m}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-l-4 border-neutral-200 border-l-blue-600 bg-white px-3 py-2.5 text-sm">
            <dt className="font-semibold text-neutral-900">Richtwert</dt>
            <dd className="text-neutral-800">{definition.dose}</dd>
            <dt className="font-semibold text-neutral-900">Anpassen</dt>
            <dd className="text-neutral-800">{definition.progression}</dd>
          </dl>
        </div>
      </div>
    </article>
  );
}
