/**
 * Eingabe-Härtung für frei eingebbare Textfelder (rein/testbar).
 *
 * - Entfernt Steuerzeichen (außer Zeilenumbruch/Tab), die Logs/Anzeigen
 *   zerschießen oder zum Verschleiern von Inhalten missbraucht werden können.
 * - Begrenzt die Länge, um übergroße Payloads (Speicher-/DoS-Vektor) zu
 *   verhindern.
 * - Trimmt Rand-Whitespace.
 *
 * Bewusst KEIN HTML-Escaping: React escaped beim Rendern selbst. Diese
 * Funktion härtet die gespeicherten Rohdaten, nicht die Darstellung.
 */

const DEFAULT_MAX = 5000;

/** Erlaubt druckbare Zeichen sowie Tab (0x09) und Zeilenumbruch (0x0A). */
function isAllowedChar(code: number): boolean {
  if (code === 0x09 || code === 0x0a) return true;
  if (code < 0x20) return false; // restliche C0-Steuerzeichen
  if (code === 0x7f) return false; // DEL
  if (code >= 0x80 && code <= 0x9f) return false; // C1-Steuerzeichen
  return true;
}

export function sanitizeText(input: unknown, maxLen: number = DEFAULT_MAX): string {
  if (typeof input !== "string") return "";
  let stripped = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (isAllowedChar(code)) stripped += ch;
  }
  const trimmed = stripped.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/** Wie `sanitizeText`, aber liefert `null` für leere Ergebnisse (für optionale Felder). */
export function sanitizeOptionalText(
  input: unknown,
  maxLen: number = DEFAULT_MAX,
): string | null {
  const s = sanitizeText(input, maxLen);
  return s.length > 0 ? s : null;
}
