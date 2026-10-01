/**
 * Betreiberangaben für Impressum/AGB/Datenschutz – aus Umgebungsvariablen, damit
 * sie ohne Code-Änderung gepflegt werden können. Fehlt LEGAL_NAME, zeigen die
 * Seiten einen deutlichen „Platzhalter“-Hinweis.
 */
export function legalInfo() {
  const e = process.env;
  return {
    name: e.LEGAL_NAME ?? "",
    street: e.LEGAL_STREET ?? "",
    city: e.LEGAL_CITY ?? "",
    email: e.LEGAL_EMAIL ?? "",
    phone: e.LEGAL_PHONE ?? "",
    vatId: e.LEGAL_VAT_ID ?? "",
    complete: Boolean(e.LEGAL_NAME && e.LEGAL_STREET && e.LEGAL_CITY && e.LEGAL_EMAIL),
  };
}
