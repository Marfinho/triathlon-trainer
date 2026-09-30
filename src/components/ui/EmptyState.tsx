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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-6 py-8 text-center">
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-xs text-neutral-400">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
