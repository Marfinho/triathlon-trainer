import { Card } from "./Card";

export interface ReadinessData {
  date: string;
  status: string | null;
  sleepTrend: string | null;
  hrvTrend: string | null;
  restingHrTrend: string | null;
  subjectiveFatigue: number | null;
  notes: string | null;
}

export interface PainData {
  date: string;
  overall: number | null;
  knee: number | null;
  achilles: number | null;
  calf: number | null;
  back: number | null;
  notes: string | null;
}

const READINESS_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

function painColor(v: number | null): string {
  if (v == null) return "#d2d2d7";
  if (v <= 1) return "#34c759";
  if (v <= 3) return "#ff9f0a";
  return "#ff3b30";
}

export function ReadinessPain({
  readiness,
  pain,
}: {
  readiness: ReadinessData | null;
  pain: PainData | null;
}) {
  return (
    <Card title="Readiness & Schmerz" subtitle="Letzter erfasster Stand">
      {!readiness && !pain ? (
        <p className="text-sm text-neutral-400">Keine Daten erfasst.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Readiness
              {readiness?.status ? (
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    READINESS_DOT[readiness.status] ?? "bg-neutral-300"
                  }`}
                />
              ) : null}
            </h3>
            {readiness ? (
              <dl className="space-y-1.5 text-sm">
                <Row label="Status" value={readiness.status ?? "—"} />
                <Row label="Schlaf" value={readiness.sleepTrend ?? "—"} />
                <Row label="HRV" value={readiness.hrvTrend ?? "—"} />
                <Row label="Ruhe-HF" value={readiness.restingHrTrend ?? "—"} />
                <Row
                  label="Subj. Müdigkeit"
                  value={String(readiness.subjectiveFatigue ?? "—")}
                />
              </dl>
            ) : (
              <p className="text-sm text-neutral-400">—</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Schmerzstatus
            </h3>
            {pain ? (
              <div className="space-y-1.5">
                {[
                  ["Gesamt", pain.overall],
                  ["Knie", pain.knee],
                  ["Achilles", pain.achilles],
                  ["Wade", pain.calf],
                  ["Rücken", pain.back],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <span className="w-20 text-sm text-neutral-500">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((val as number) ?? 0) * 10}%`,
                          backgroundColor: painColor(val as number | null),
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm text-neutral-700">
                      {val ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">—</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-800">{value}</dd>
    </div>
  );
}
