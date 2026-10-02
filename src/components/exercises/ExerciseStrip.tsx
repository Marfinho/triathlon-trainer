import { isExercise3d, renderFrameAny, type AnyExerciseDefinition } from "@/domain/exercises/any";
import { ExerciseFigure } from "./ExerciseFigure";
import { Exercise3dStill } from "./Exercise3dStill";

/** Ablauf in vier Bildern mit Bildunterschrift. */
export function ExerciseStrip({ definition }: { definition: AnyExerciseDefinition }) {
  return (
    <section aria-label="Ablauf in vier Bildern">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900">
        Ablauf in vier Bildern
      </h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {definition.frames.map((f, i) => (
          <figure key={i} className="m-0">
            {isExercise3d(definition) ? (
              <Exercise3dStill
                definition={definition}
                spec={{ kind: "frame", index: i }}
                svg={renderFrameAny(definition, i)}
                label={`${definition.title}, Bild ${i + 1}: ${f.label}`}
              />
            ) : (
              <ExerciseFigure svg={renderFrameAny(definition, i)} />
            )}
            <figcaption className="mt-1.5 flex items-start gap-2 text-xs font-semibold leading-snug text-neutral-800">
              <span
                aria-hidden="true"
                className="grid h-5 w-5 flex-none place-items-center rounded-full bg-neutral-900 text-[11px] text-white"
              >
                {i + 1}
              </span>
              <span>{f.label}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        {isExercise3d(definition)
          ? "Die blasse Figur zeigt das vorherige Schlüsselbild – also, woher die Bewegung kommt."
          : "Die blasse Figur zeigt, woher die Bewegung kommt: in Bild 2 und 3 die Startposition, in Bild 4 die Endposition."}
      </p>
    </section>
  );
}
