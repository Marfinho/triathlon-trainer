import { renderFrameSvg } from "@/domain/exercises/engine";
import type { ExerciseDefinition } from "@/domain/exercises/schema";
import { ExerciseFigure } from "./ExerciseFigure";

/** Ablauf in vier Bildern mit Bildunterschrift. */
export function ExerciseStrip({ definition }: { definition: ExerciseDefinition }) {
  return (
    <section aria-label="Ablauf in vier Bildern">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Ablauf in vier Bildern
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {definition.frames.map((f, i) => (
          <figure key={i} className="m-0">
            <ExerciseFigure svg={renderFrameSvg(definition, i)} />
            <figcaption className="mt-1.5 flex items-start gap-2 text-xs font-semibold leading-snug text-neutral-800 dark:text-neutral-200">
              <span
                aria-hidden="true"
                className="grid h-5 w-5 flex-none place-items-center rounded-full bg-neutral-900 text-[11px] text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                {i + 1}
              </span>
              <span>{f.label}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Die blasse Figur zeigt, woher die Bewegung kommt: in Bild 2 und 3 die Startposition, in
        Bild 4 die Endposition.
      </p>
    </section>
  );
}
