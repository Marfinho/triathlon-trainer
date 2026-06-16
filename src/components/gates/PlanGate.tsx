import type { ReactNode } from "react";
import { UpgradeCard } from "./UpgradeCard";

/**
 * FEATURE-GATE: rendert `children`, wenn `allowed`, sonst eine UpgradeCard
 * (bzw. ein optionales eigenes Fallback). Reine Präsentation – die Berechtigung
 * (hasFeature(plan, …)) wird vom aufrufenden Server-Code bestimmt.
 */
export function PlanGate({
  allowed,
  title,
  description,
  fallback,
  children,
}: {
  allowed: boolean;
  title: string;
  description: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <UpgradeCard title={title} description={description} />}</>;
}
