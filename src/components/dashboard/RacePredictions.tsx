import { Card } from "./Card";
import {
  RUN_DISTANCES,
  TRI_DISTANCES,
  predictRunTime,
  predictTriathlon,
  paceForRun,
  formatDuration,
  matchRacePrediction,
  type PredictionProfile,
} from "@/domain/training/prediction";

export interface PredictionRace {
  id: string;
  name: string;
  date: string;
  type: string;
  distance: string | null;
}

export function RacePredictions({
  profile,
  races,
}: {
  profile: PredictionProfile;
  races: PredictionRace[];
}) {
  const hasAny =
    profile.thresholdPaceSecPerKm != null ||
    profile.ftpWatts != null ||
    profile.cssPer100m != null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = races
    .filter((r) => r.date.slice(0, 10) >= todayIso)
    .map((r) => ({ race: r, pred: matchRacePrediction(r.type, r.distance, profile) }))
    .filter((x) => x.pred && x.pred.totalSec != null);

  return (
    <Card
      title="Wettkampf-Vorhersage"
      subtitle="Geschätzte Zeiten aus Schwellen-Pace, FTP und CSS"
    >
      {!hasAny ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Hinterlege FTP, Schwellen-Pace und CSS (unter „Trainingszonen" oder im
          „Rechner"), um Vorhersagen zu erhalten.
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
                    className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                  >
                    <span className="text-sm text-neutral-800">
                      {race.name}
                      <span className="ml-2 text-xs text-neutral-400">{pred!.label}</span>
                    </span>
                    <span className="text-sm font-semibold text-blue-600">
                      {formatDuration(pred!.totalSec)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Lauf */}
          {profile.thresholdPaceSecPerKm != null ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Laufen
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RUN_DISTANCES.map((d) => {
                  const sec = predictRunTime(d.km, profile.thresholdPaceSecPerKm!);
                  const pace = paceForRun(d.km, sec);
                  return (
                    <div key={d.key} className="rounded-xl border border-neutral-200 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                        {d.label}
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-neutral-900">
                        {formatDuration(sec)}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {formatDuration(pace)} /km
                      </p>
                    </div>
                  );
                })}
              </div>
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
                  {TRI_DISTANCES.map((t) => {
                    const p = predictTriathlon(t, profile);
                    return (
                      <tr key={t.key}>
                        <td className="py-2 pr-3 text-neutral-700">{t.label}</td>
                        <td className="py-2 pr-3 tabular-nums text-neutral-600">
                          {formatDuration(p.swimSec)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-neutral-600">
                          {formatDuration(p.bikeSec)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-neutral-600">
                          {formatDuration(p.runSec)}
                        </td>
                        <td className="py-2 tabular-nums font-semibold text-neutral-900">
                          {formatDuration(p.totalSec)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400">
            Schätzung inkl. Wechselzeiten; Annahmen: flacher Kurs, TT-Position,
            renntypische Intensität. Tatsächliche Zeiten hängen von Strecke, Wetter
            und Tagesform ab
            {profile.ctl != null ? ` (aktuelle Fitness CTL ${Math.round(profile.ctl)})` : ""}.
          </p>
        </div>
      )}
    </Card>
  );
}
