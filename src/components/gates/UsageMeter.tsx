import Link from "next/link";

/**
 * SOFT-GATE-Anzeige: Fortschrittsbalken (Amber) eines Kontingents. Ab >80 %
 * Warnfarbe; bei Erreichen des Limits ein Upgrade-Hinweis.
 */
export function UsageMeter({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  if (!Number.isFinite(limit)) return null; // unbegrenzt -> kein Meter
  const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const warn = pct >= 80;
  const reached = current >= limit;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-neutral-700">{label}</span>
        <span className={warn ? "font-semibold text-[#b07700]" : "text-neutral-500"}>
          {current} / {limit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: reached ? "#ef4444" : "#F0A500",
          }}
        />
      </div>
      {reached ? (
        <p className="mt-2 text-[11px] text-neutral-500">
          Free-Limit erreicht ·{" "}
          <Link href="/#pricing" className="font-medium text-[#b07700] hover:underline">
            Upgrade auf Pro
          </Link>
        </p>
      ) : null}
    </div>
  );
}
