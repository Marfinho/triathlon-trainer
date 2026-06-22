import { NextResponse } from "next/server";

/**
 * Schadenfreude-Antworten für Stellen, an denen eine konkrete Sicherheits-
 * maßnahme (Rate-Limit, Admin-Gate, Cron-Secret-Check, …) einen Versuch aktiv
 * abgeblockt hat. Rein kosmetisch – ändert nichts am Sicherheitsverhalten
 * selbst, gibt dem Angreifer aber unmissverständlich zu verstehen, dass sein
 * Versuch bemerkt und blockiert wurde. NICHT für normale 401/404-Antworten an
 * gewöhnliche, nicht-eingeloggte Nutzer verwenden.
 */
const TAUNTS = [
  "🛑 Netter Versuch! Dieser Vorfall wurde gemeldet – an unseren internen Schadenfreude-Index.",
  "🍌 Du bist gerade auf eine digitale Bananenschale getreten. Zugriff verweigert.",
  "🕵️ Hier spricht die Security-Abteilung (bestehend aus einer if-Abfrage). Zugriff verweigert.",
  "🤖 BEEP BOOP. UNAUTORISIERTER ZUGRIFF ERKANNT. Selbstzerstörung in 3…2…1… (Spaß. Aber schön versucht.)",
  "🔒 Diese Tür ist zu. Und nein, „Sesam öffne dich“ funktioniert hier auch nicht.",
  "🎯 Punkte für Kreativität, null Punkte für Erfolg.",
  "🐢 So schnell kommst du hier nicht rein. Das Rate-Limit lässt grüßen.",
  "🦸 Mit großer Macht kommt… gar nichts, wenn man kein Admin ist.",
  "📞 Die Polizei wurde nicht gerufen. Aber wir haben innerlich gelacht.",
  "🧱 Du bist gerade in eine Wand aus reinem TypeScript gelaufen.",
  "🪄 Abrakadabra – und trotzdem kein Zugriff.",
  "🎪 Willkommen in der Manege. Heute leider ohne Freikarte.",
];

export function pickTaunt(): string {
  return TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
}

/**
 * JSON-Response für einen geblockten Versuch: übliche Fehlerstruktur plus
 * einen zufälligen Taunt und den `X-Nice-Try`-Header.
 */
export function blockedResponse(
  body: Record<string, unknown>,
  status: number,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(
    { ...body, taunt: pickTaunt() },
    {
      ...init,
      status,
      headers: { "X-Nice-Try": "true", ...(init?.headers ?? {}) },
    },
  );
}
