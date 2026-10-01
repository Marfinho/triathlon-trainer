import { MUSCLE_ROLE_LABEL, musclesOf, renderHeroAny, type AnyExerciseDefinition } from "@/domain/exercises/any";
import { ExerciseFigure } from "./ExerciseFigure";

/** Muskelbild (Zielposition) mit nummerierter Legende. */
export function ExerciseMuscleView({ definition }: { definition: AnyExerciseDefinition }) {
  return (
    <section aria-label="Zielmuskeln">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900">Zielmuskeln</h3>
      <ExerciseFigure svg={renderHeroAny(definition)} />
      <ol className="mt-3 space-y-2">
        {musclesOf(definition).map((m, i) => (
          <li key={m.key} className="flex gap-2.5 text-sm leading-snug">
            <span className={`exfig-num ${m.role === "stretch" ? "stretch" : ""}`} aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <span className="sr-only">{i + 1}. </span>
              <strong className="font-semibold text-neutral-900">{m.label}</strong>
              <span className="ml-1.5 inline-block rounded-full bg-neutral-100 px-2 text-xs text-neutral-600">
                {MUSCLE_ROLE_LABEL[m.role]}
              </span>
              <span className="block text-neutral-600">{m.note}</span>
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
      className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600"
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
