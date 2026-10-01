/**
 * Welche geplanten Einheiten der Kraft-Player führen kann (rein, ohne DB –
 * auch im Client nutzbar).
 *
 * Neben `strength` und `mobility` zählt auch `other`: Externe LLMs planen
 * Mobility-/Stabi-Einheiten häufig als „Sonstige“. Einheiten jeder Sportart
 * mit Übungssegmenten (`exercise`) zählen ebenfalls.
 */
export const GUIDED_SPORTS = ["strength", "mobility", "other"] as const;

/** Übungs-IDs aus Segmenten (Reihenfolge des ersten Auftretens, ohne Duplikate). */
export function exerciseIdsFromSegments(segments: unknown): string[] {
  if (!Array.isArray(segments)) return [];
  const ids: string[] = [];
  for (const s of segments) {
    const id = (s as { exercise?: { id?: unknown } | null } | null)?.exercise?.id;
    if (typeof id === "string" && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function isGuidedWorkout(sport: string, segments: unknown): boolean {
  return (
    (GUIDED_SPORTS as readonly string[]).includes(sport) ||
    exerciseIdsFromSegments(segments).length > 0
  );
}
