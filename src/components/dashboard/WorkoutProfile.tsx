import {
  buildWorkoutProfile,
  type ProfileSegmentInput,
} from "@/domain/training/workoutProfile";

function fmtDur(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.round(sec / 60);
  return `${m}′`;
}

/**
 * Grafisches Leistungsprofil eines geplanten Workouts: Balken über die Zeit,
 * Höhe = Ziel-Intensität (%FTP), Farbe = Zone. Darunter eine kompakte
 * Segmentliste. Beantwortet „was erwartet mich?".
 */
export function WorkoutProfile({
  segments,
  ftp,
  sport,
}: {
  segments: ProfileSegmentInput[];
  ftp: number;
  sport: string;
}) {
  const bars = buildWorkoutProfile(segments, { ftp });
  if (bars.length === 0) return null;

  const totalWeight = bars.reduce((s, b) => s + b.weight, 0) || 1;
  const maxPct = Math.max(1.3, ...bars.map((b) => b.pctFtp));
  const showWatts = sport === "bike" || sport === "brick";

  function targetText(b: (typeof bars)[number]): string {
    if (showWatts) return `${b.watts} W`;
    if (b.rpeTarget) return `RPE ${b.rpeTarget}`;
    return `${Math.round(b.pctFtp * 100)}% FTP`;
  }

  return (
    <div>
      {/* Balken-Profil */}
      <div className="relative h-24 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        {/* 100%-FTP-Referenzlinie */}
        <div
          className="pointer-events-none absolute inset-x-1 border-t border-dashed border-neutral-300"
          style={{ bottom: `${(1 / maxPct) * 100}%` }}
          title="100 % FTP"
        />
        <div className="flex h-full w-full items-end gap-px">
          {bars.map((b, i) => (
            <div
              key={i}
              className="rounded-t-sm"
              style={{
                width: `${(b.weight / totalWeight) * 100}%`,
                height: `${Math.max(4, (b.pctFtp / maxPct) * 100)}%`,
                backgroundColor: b.color,
              }}
              title={`${b.label} · ${fmtDur(b.durationSec)} · ${targetText(b)}`}
            />
          ))}
        </div>
      </div>

      {/* Segmentliste */}
      <ul className="mt-2 space-y-1">
        {bars.map((b, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            <span className="font-medium text-neutral-700">{b.label}</span>
            <span className="text-neutral-400">
              {[fmtDur(b.durationSec), b.distanceM ? `${b.distanceM} m` : "", targetText(b)]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {b.cadenceNote ? (
              <span className="text-neutral-400">· {b.cadenceNote}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
