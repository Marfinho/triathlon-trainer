import type { ReactNode } from "react";

/**
 * Einheitlicher Leerzustand für Listen/Karten – ruhiger als ein nackter Satz
 * und mit optionalem Call-to-Action.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-9 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-pink-100 text-lg" aria-hidden="true">
        ✦
      </div>
      <p className="text-sm font-semibold text-neutral-700">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-xs text-neutral-400">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
