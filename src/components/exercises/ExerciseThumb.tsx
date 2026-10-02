import { isExercise3d, renderThumbAny, type AnyExerciseDefinition } from "@/domain/exercises/any";
import { ExerciseFigure } from "./ExerciseFigure";
import { Exercise3dStill } from "./Exercise3dStill";

/** Kleines statisches Bild der Endposition (serverseitig gerendert). */
export function ExerciseThumb({
  definition,
  className = "w-20",
}: {
  definition: AnyExerciseDefinition;
  className?: string;
}) {
  if (isExercise3d(definition))
    return (
      <Exercise3dStill
        definition={definition}
        spec={{ kind: "thumb" }}
        svg={renderThumbAny(definition)}
        label={definition.title}
        className={`shrink-0 self-start ${className}`}
      />
    );
  return <ExerciseFigure svg={renderThumbAny(definition)} className={`shrink-0 self-start ${className}`} />;
}
