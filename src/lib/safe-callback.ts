/**
 * Ziel nach dem Login aus `callbackUrl` – ausschließlich same-origin (kein Open
 * Redirect). Alles andere (fremder Host, javascript:, `//evil`, `/\evil`, …)
 * fällt auf `fallback` zurück. Gibt nur Pfad + Query zurück.
 */
export function safeCallbackPath(
  raw: string | null | undefined,
  origin: string,
  fallback = "/dashboard",
): string {
  if (!raw || raw.length > 4096) return fallback;
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return fallback;
    const path = `${u.pathname}${u.search}`;
    return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}
