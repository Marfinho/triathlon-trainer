import { Card } from "./Card";
import { formatDuration } from "@/domain/training/prediction";
import {
  SOURCE_LABELS,
  describeCapacity,
  forecastRace,
  forecastRunDistances,
  forecastTriathlons,
  type CapacityEstimate,
  type Confidence,
  type Corridor,
  type PerformanceModel,
} from "@/domain/training/performanceModel";

export interface PredictionRace {
  id: string;
  name: string;
  date: string;
  type: string;
  distance: string | null;
}

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  hoch: "bg-emerald-50 text-emerald-700",
  mittel: "bg-amber-50 text-amber-700",
  niedrig: "bg-neutral-100 text-neutral-500",
};

function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLE[value]}`}>
      {value}
    </span>
  );
}

/** "43:10 – 45:40" (schnell – vorsichtig). */
function range(c: Corridor | null): string {
  if (!c) return "—";
  return `${formatDuration(c.fastSec)} – ${formatDuration(c.slowSec)}`;
}

function DataBasis({
  label,
  sport,
  model,
  extra,
}: {
  label: string;
  sport: "run" | "bike" | "swim";
  model: (CapacityEstimate & { mode?: string }) | null;
  extra?: string[];
}) {
  if (!model) {
    return (
      <li className="text-neutral-400">
        <span className="font-medium text-neutral-500">{label}:</span> keine Daten
      </li>
    );
  }
  const sources = model.sources
    .filter((s) => s.share >= 0.03)
    .map((s) => `${SOURCE_LABELS[s.kind]} ${Math.round(s.share * 100)} %`)
    .join(" · ");
  return (
    <li>
      <span className="font-medium text-neutral-700">{label}:</span>{" "}
      {describeCapacity(sport, model)} ± {Math.round(model.relSpread * 1000) / 10} %
      <span className="text-neutral-400">
        {" "}
        · {model.samples} Einheiten · {sources}
        {model.flooredByBestEffort ? " · durch Bestleistung angehoben" : ""}
        {extra && extra.length > 0 ? ` · ${extra.join(" · ")}` : ""}
      </span>
    </li>
  );
}

export function RacePredictions({
  model,
  ctl,
  races,
}: {
  model: PerformanceModel;
  ctl?: number | null;
  races: PredictionRace[];
}) {
  const hasAny = model.run != null || model.bike != null || model.swim != null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = races
    .filter((r) => r.date.slice(0, 10) >= todayIso)
    .map((r) => ({ race: r, pred: forecastRace(r.type, r.distance, model) }))
    .filter((x) => x.pred != null);

  const runForecasts = model.run ? forecastRunDistances(model.run) : [];
  const triForecasts = forecastTriathlons(model);
  const triNotes = [...new Set(triForecasts.flatMap((t) => t.notes))];

  return (
    <Card
      title="Wettkampf-Vorhersage"
      subtitle="Realistischer Zielkorridor aus deinen Trainingsdaten (Tempo, HF, RPE, Höhenmeter, Umfang, Ergebnisse)"
    >
      {!hasAny ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Noch zu wenig Daten: Synchronisiere Aktivitäten (idealerweise mit HF oder RPE) oder
          hinterlege Schwellenwerte, um Vorhersagen zu erhalten.
        </p>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Deine kommenden Rennen
              </h3>
              <ul className="space-y-1.5">
                {upcoming.map(({ race, pred }) => (
                  <li
                    key={race.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                  >
                    <span className="text-sm text-neutral-800">
                      {race.name}
                      <span className="ml-2 text-xs text-neutral-400">{pred!.label}</span>
                    </span>
                    <span className="flex items-center gap-2 text-right">
                      <span>
                        <span className="block text-sm font-semibold tabular-nums text-blue-600">
                          {range(pred!.corridor)}
                        </span>
                        <span className="block text-[11px] tabular-nums text-neutral-400">
                          wahrscheinlich {formatDuration(pred!.corridor.likelySec)}
                        </span>
                      </span>
                      <ConfidenceBadge value={pred!.confidence} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Lauf */}
          {runForecasts.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Laufen
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {runForecasts.map((f) => (
                  <div key={f.key} className="rounded-xl border border-neutral-200 p-3">
                    <p className="flex items-center justify-between text-[11px] uppercase tracking-wide text-neutral-400">
                      {f.label}
                      <ConfidenceBadge value={f.confidence} />
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
                      {formatDuration(f.corridor.likelySec)}
                    </p>
                    <p className="text-[11px] tabular-nums text-neutral-500">
                      {range(f.corridor)}
                    </p>
                    <p className="text-[11px] tabular-nums text-neutral-400">
                      {formatDuration(f.pace.fastSec)}–{formatDuration(f.pace.slowSec)} /km
                    </p>
                  </div>
                ))}
              </div>
              {runForecasts.some((f) => f.notes.length > 0) ? (
                <p className="mt-1.5 text-[11px] text-neutral-400">
                  {[...new Set(runForecasts.flatMap((f) => f.notes))].join(" ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Triathlon */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Triathlon
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-400">
                    <th className="py-2 pr-3 font-medium">Distanz</th>
                    <th className="py-2 pr-3 font-medium">Schwimmen</th>
                    <th className="py-2 pr-3 font-medium">Rad</th>
                    <th className="py-2 pr-3 font-medium">Laufen</th>
                    <th className="py-2 font-medium">Gesamt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {triForecasts.map((t) => (
                    <tr key={t.key} className="align-top">
                      <td className="py-2 pr-3 text-neutral-700">
                        {t.label}
                        <div className="mt-0.5">
                          <ConfidenceBadge value={t.confidence} />
                        </div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-neutral-600">
                        {range(t.swim)}
                        {t.swimPacePer100m ? (
                          <span className="block text-[11px] text-neutral-400">
                            {formatDuration(t.swimPacePer100m.likelySec)} /100 m
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-neutral-600">
                        {range(t.bike)}
                        {t.bikeTarget ? (
                          <span className="block text-[11px] text-neutral-400">
                            {t.bikeTarget.watts != null ? `${t.bikeTarget.watts} W · ` : ""}
                            {t.bikeTarget.kmh.toFixed(1)} km/h
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-neutral-600">
                        {range(t.run)}
                        {t.runPaceSecPerKm ? (
                          <span className="block text-[11px] text-neutral-400">
                            {formatDuration(t.runPaceSecPerKm.fastSec)}–
                            {formatDuration(t.runPaceSecPerKm.slowSec)} /km
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 tabular-nums">
                        <span className="font-semibold text-neutral-900">
                          {formatDuration(t.total?.likelySec ?? null)}
                        </span>
                        {t.total ? (
                          <span className="block text-[11px] text-neutral-400">
                            {range(t.total)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {triNotes.length > 0 ? (
              <p className="mt-1.5 text-[11px] text-neutral-400">{triNotes.join(" ")}</p>
            ) : null}
          </div>

          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Datenbasis
            </h3>
            <ul className="space-y-0.5 text-[11px] text-neutral-500">
              <DataBasis
                label="Laufen"
                sport="run"
                model={model.run}
                extra={[
                  ...(model.run?.personalHrCurve ? ["HF-Tempo-Kurve individuell kalibriert"] : []),
                  ...(model.run ? [`Ermüdungsexponent ${model.run.riegelExponent.toFixed(3)}`] : []),
                ]}
              />
              <DataBasis
                label="Rad"
                sport="bike"
                model={model.bike}
                extra={[
                  ...(model.bike?.personalHrCurve ? ["HF-Kurve individuell kalibriert"] : []),
                  ...(model.bike?.personalSpeedModel ? ["Tempo aus eigenen Fahrten kalibriert"] : []),
                ]}
              />
              <DataBasis label="Schwimmen" sport="swim" model={model.swim} />
              {model.thresholdHr != null ? (
                <li className="text-neutral-400">
                  Schwellen-HF {model.thresholdHr} bpm
                  {model.thresholdHrEstimated ? " (aus Max-HF geschätzt – im Profil eintragen für mehr Genauigkeit)" : ""}
                </li>
              ) : null}
            </ul>
          </div>

          <p className="text-[11px] text-neutral-400">
            Korridor = realistische Spanne von „alles passt“ bis „zäher Tag“; die fett gedruckte
            Zeit ist der wahrscheinlichste Wert. Jüngere Einheiten zählen stärker, Wettkampfergebnisse
            und harte Einheiten am stärksten. Annahmen: flacher Kurs, renntypische Intensität,
            Wechselzeiten inklusive
            {ctl != null ? ` (aktuelle Fitness CTL ${Math.round(ctl)})` : ""}.
          </p>
        </div>
      )}
    </Card>
  );
}
