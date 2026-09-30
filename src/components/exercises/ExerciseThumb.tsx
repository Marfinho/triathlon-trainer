import { renderThumbSvg } from "@/domain/exercises/engine";
import type { ExerciseDefinition } from "@/domain/exercises/schema";
import { ExerciseFigure } from "./ExerciseFigure";

/** Kleines statisches Bild der Endposition (serverseitig gerendert). */
export function ExerciseThumb({
  definition,
  className = "w-20",
}: {
  definition: ExerciseDefinition;
  className?: string;
}) {
  return <ExerciseFigure svg={renderThumbSvg(definition)} className={`shrink-0 self-start ${className}`} />;
}
