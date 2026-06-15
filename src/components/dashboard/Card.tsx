import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-sky-300">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const SPORT_LABELS: Record<string, string> = {
  run: "Laufen",
  bike: "Rad",
  swim: "Schwimmen",
  strength: "Kraft",
  brick: "Koppel",
  mobility: "Mobility",
  walk: "Gehen",
  cross_training: "Cross",
  other: "Sonstige",
  rest: "Ruhetag",
};

export function sportLabel(sport: string): string {
  return SPORT_LABELS[sport] ?? sport;
}
