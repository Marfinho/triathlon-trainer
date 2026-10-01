import { renderThumbAny, type AnyExerciseDefinition } from "@/domain/exercises/any";
import { ExerciseFigure } from "./ExerciseFigure";

/** Kleines statisches Bild der Endposition (serverseitig gerendert). */
export function ExerciseThumb({
  definition,
  className = "w-20",
}: {
  definition: AnyExerciseDefinition;
  className?: string;
}) {
  return <ExerciseFigure svg={renderThumbAny(definition)} className={`shrink-0 self-start ${className}`} />;
}
