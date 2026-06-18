/**
 * Schlichte Lade-Platzhalter (Shimmer), um Layout-Sprünge und „springende"
 * Spinner beim Nachladen zu vermeiden.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-200/70 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Mehrzeiliger Text-Platzhalter. */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Lädt…">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
