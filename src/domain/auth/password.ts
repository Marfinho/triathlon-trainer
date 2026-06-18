/**
 * Passwort-Stärke-Prüfung (rein/testbar). Erzwingt eine Mindestlänge,
 * Zeichenvielfalt und blockt offensichtlich schwache/häufige Passwörter –
 * server-seitig durchgesetzt, damit Client-Manipulation nichts bringt.
 */

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
}

const MIN_LENGTH = 8;
// Sehr lange Eingaben abweisen: bcrypt verarbeitet ohnehin nur 72 Byte und
// extrem lange Strings sind ein unnötiger Rechen-/DoS-Vektor.
const MAX_LENGTH = 200;

// Kleine Sperrliste der häufigsten/triviellsten Passwörter.
const COMMON = new Set([
  "password",
  "passwort",
  "12345678",
  "123456789",
  "qwertz123",
  "qwerty123",
  "11111111",
  "iloveyou",
  "admin123",
  "letmein1",
  "football",
]);

export function validatePasswordStrength(password: string): PasswordCheck {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Mindestens ${MIN_LENGTH} Zeichen.`);
  }
  if (password.length > MAX_LENGTH) {
    errors.push(`Höchstens ${MAX_LENGTH} Zeichen.`);
  }
  if (!/[a-zA-Z]/.test(password)) {
    errors.push("Mindestens ein Buchstabe.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Mindestens eine Ziffer.");
  }
  if (COMMON.has(password.toLowerCase())) {
    errors.push("Dieses Passwort ist zu verbreitet.");
  }

  return { ok: errors.length === 0, errors };
}
