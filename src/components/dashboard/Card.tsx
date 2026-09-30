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
    <section className="card-neon animate-rise rounded-[28px] p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
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

/** Einheitliche Pop-Farben je Disziplin (für Graphen/Badges; hell & dunkel lesbar). */
export const SPORT_COLORS: Record<string, string> = {
  swim: "#2F9BFF",
  bike: "#14C4B0",
  run: "#FF6B4A",
  strength: "#B455F5",
  brick: "#7B61FF",
  other: "#9C98AE",
};

export function sportColor(sport: string): string {
  return SPORT_COLORS[sport] ?? "#9C98AE";
}
