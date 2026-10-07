/**
 * ICS-Feed (RFC 5545) für den Trainingsplan. Reiner Funktionskern ohne DB:
 * gleiche Eingabe → gleiche Ausgabe. Ganztägige Ereignisse, da Einheiten
 * keine Uhrzeit haben.
 */

export interface IcsEvent {
  /** Stabile, nicht umkehrbare Kennung (kein Roh-Datenbank-Id). */
  uid: string;
  /** `YYYY-MM-DD` */
  date: string;
  summary: string;
  description?: string;
  /** Ohne Angabe CONFIRMED. */
  status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  categories?: string;
}

const CRLF = "\r\n";

/** TEXT-Werte nach RFC 5545 §3.3.11 maskieren; Steuerzeichen entfernen. */
export function escapeIcsText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Zeilen auf höchstens 75 Oktette falten (Fortsetzung mit Leerzeichen), UTF-8-sicher. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // führendes Leerzeichen zählt mit
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const compactDate = (iso: string) => iso.replace(/-/g, "");

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, "0")}${String(next.getUTCDate()).padStart(2, "0")}`;
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(events: IcsEvent[], opts: { name: string; now: Date }): string {
  const dtstamp = stamp(opts.now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brick//Training//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(opts.name)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compactDate(e.date)}`,
      `DTEND;VALUE=DATE:${nextDay(e.date)}`,
      `SUMMARY:${escapeIcsText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    if (e.categories) lines.push(`CATEGORIES:${escapeIcsText(e.categories)}`);
    lines.push(`STATUS:${e.status ?? "CONFIRMED"}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
