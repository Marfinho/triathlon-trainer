import { parseIsoDate } from "@/domain/training/dates";

/**
 * Sprechtext für Sprachassistenten (Home Assistant → Sonos-TTS / Alexa Media Player).
 *
 * Reiner Funktionskern ohne DB und ohne Zufall: gleiche Eingabe → gleicher Text.
 * Der Text ist für Sprachausgabe geschrieben: ganze Sätze, keine Klammern,
 * Sonderzeichen oder Abkürzungen, Sportarten ausgeschrieben, höchstens
 * `MAX_SPEECH_CHARS` Zeichen. Es kommen bewusst keine Gesundheits- oder
 * Schmerzdaten vor – nur Training, grobe Form und der Wettkampf-Countdown.
 */

export const MAX_SPEECH_CHARS = 400;
const MAX_TITLE_CHARS = 40;
const MAX_ITEMS_PER_DAY = 3;

export type VoiceDay = "today" | "tomorrow" | "week";
export type VoiceDetail = "short" | "normal";

export interface VoiceItem {
  sport: string;
  title: string;
  durationMin: number;
  status: "planned" | "done";
}

export interface VoiceDayInput {
  /** `YYYY-MM-DD` (lokaler Kalendertag des Nutzers). */
  date: string;
  items: VoiceItem[];
}

export interface SpeechInput {
  day: VoiceDay;
  detail: VoiceDetail;
  /** Heutiger Kalendertag (`YYYY-MM-DD`), bestimmt „Heute“/„Morgen“/Wochentag. */
  today: string;
  days: VoiceDayInput[];
  /** Formzustand aus dem Belastungsmodell (nur bei `detail: "normal"` verwendet). */
  form?: { state: string } | null;
  /** Nächster Wettkampf (nur bei `detail: "normal"` verwendet). */
  nextRace?: { name: string; daysToRace: number } | null;
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/**
 * Macht Nutzertext sprechbar und unschädlich: nur Buchstaben, Ziffern und
 * Leerzeichen, „&“ → „und“, gekürzt an einer Wortgrenze.
 */
export function sanitizeSpeech(input: unknown, max = MAX_TITLE_CHARS): string {
  const raw = typeof input === "string" ? input : "";
  const cleaned = raw
    .replace(/&/g, " und ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trim();
}

/** 36 → „36 Minuten“, 60 → „1 Stunde“, 80 → „1 Stunde 20“, 120 → „2 Stunden“. */
export function formatDurationSpeech(minutes: number): string {
  const total = Math.round(minutes);
  if (!Number.isFinite(total) || total <= 0) return "";
  if (total < 60) return total === 1 ? "1 Minute" : `${total} Minuten`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hours = h === 1 ? "1 Stunde" : `${h} Stunden`;
  return m === 0 ? hours : `${hours} ${m}`;
}

const SPORT_ACTIVITY: Record<string, string> = {
  run: "Laufen",
  bike: "Radfahren",
  swim: "Schwimmen",
  strength: "Krafttraining",
  brick: "Koppeltraining",
  mobility: "Mobilitätstraining",
  walk: "Gehen",
  cross_training: "Cross Training",
};

/** Nominalphrase im Nominativ mit Artikel, für „… hast du schon gemacht“. */
const SPORT_DONE: Record<string, { article: "das" | "der"; noun: string }> = {
  run: { article: "das", noun: "Lauftraining" },
  bike: { article: "das", noun: "Radtraining" },
  swim: { article: "das", noun: "Schwimmtraining" },
  strength: { article: "das", noun: "Krafttraining" },
  brick: { article: "das", noun: "Koppeltraining" },
  mobility: { article: "das", noun: "Mobilitätstraining" },
  walk: { article: "der", noun: "Spaziergang" },
  cross_training: { article: "das", noun: "Cross Training" },
};

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const NUMBER_WORDS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];

const activityName = (sport: string) => SPORT_ACTIVITY[sport] ?? "Training";
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

function dayLabel(date: string, today: string): string {
  const diff = Math.round((parseIsoDate(date).getTime() - parseIsoDate(today).getTime()) / 86_400_000);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  return WEEKDAYS[parseIsoDate(date).getUTCDay()];
}

function plannedPhrase(item: VoiceItem): string {
  const duration = formatDurationSpeech(item.durationMin);
  return duration ? `${activityName(item.sport)} für ${duration}` : activityName(item.sport);
}

/** Aufzählung der ersten Einheiten, Rest als „und N weitere“. */
function listWithOverflow(phrases: string[]): string {
  if (phrases.length <= MAX_ITEMS_PER_DAY) return joinList(phrases);
  const shown = phrases.slice(0, MAX_ITEMS_PER_DAY);
  return `${shown.join(", ")} und ${phrases.length - MAX_ITEMS_PER_DAY} weitere`;
}

function doneSentence(done: VoiceItem[]): string {
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const d of done) {
    const key = SPORT_DONE[d.sport] ? d.sport : "other";
    if (seen.has(key)) continue;
    seen.add(key);
    const p = SPORT_DONE[d.sport] ?? { article: "das" as const, noun: "Training" };
    phrases.push(`${p.article} ${p.noun}`);
  }
  if (phrases.length === 0) return "";
  const text = joinList(phrases);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} hast du schon gemacht.`;
}

// ---------------------------------------------------------------------------
// Ein Tag (heute / morgen)
// ---------------------------------------------------------------------------

function daySentences(input: SpeechInput, day: VoiceDayInput): string[] {
  const label = dayLabel(day.date, input.today);
  const real = day.items.filter((i) => i.sport !== "rest");
  const planned = real.filter((i) => i.status === "planned");
  const done = real.filter((i) => i.status === "done");
  const sentences: string[] = [];

  if (real.length === 0) {
    const rest = day.items.some((i) => i.sport === "rest");
    return [rest ? `${label} ist Ruhetag.` : `${label} ist nichts geplant.`];
  }

  if (planned.length > 0) {
    const noch = done.length > 0 ? " noch" : "";
    if (planned.length === 1) {
      sentences.push(`${label} steht${noch} ${plannedPhrase(planned[0])} auf dem Plan.`);
      const title = sanitizeSpeech(planned[0].title);
      const generic = title.toLowerCase() === activityName(planned[0].sport).toLowerCase();
      if (input.detail === "normal" && title && !generic) sentences.push(`Die Einheit heißt ${title}.`);
    } else {
      const list = listWithOverflow(planned.map(plannedPhrase));
      sentences.push(`${label} stehen${noch} ${numberWord(planned.length)} Einheiten an: ${list}.`);
    }
  }
  const doneText = doneSentence(done);
  if (doneText) sentences.push(doneText);
  return sentences;
}

// ---------------------------------------------------------------------------
// Woche
// ---------------------------------------------------------------------------

function weekDaySentence(input: SpeechInput, day: VoiceDayInput): string {
  const label = dayLabel(day.date, input.today);
  const real = day.items.filter((i) => i.sport !== "rest");
  if (real.length === 0) {
    return day.items.some((i) => i.sport === "rest") ? `${label} Ruhetag.` : `${label} frei.`;
  }
  const phrases = real.map((i) => (i.status === "done" ? `${activityName(i.sport)} erledigt` : plannedPhrase(i)));
  return `${label} ${listWithOverflow(phrases)}.`;
}

// ---------------------------------------------------------------------------
// Zusatzinfos (nur detail=normal)
// ---------------------------------------------------------------------------

function formSentence(form: SpeechInput["form"]): string {
  switch (form?.state) {
    case "fresh":
      return "Du bist frisch und gut erholt.";
    case "optimal":
      return "Du bist gut erholt.";
    case "neutral":
      return "Deine Form ist ausgeglichen.";
    case "tired":
      return "Du bist gerade etwas ermüdet.";
    case "overload":
      return "Deine Belastung ist gerade hoch.";
    default:
      return "";
  }
}

function raceSentence(race: SpeechInput["nextRace"]): string {
  if (!race || !Number.isFinite(race.daysToRace) || race.daysToRace < 0) return "";
  const name = sanitizeSpeech(race.name) || "Wettkampf";
  const d = Math.round(race.daysToRace);
  if (d === 0) return `Heute ist dein Wettkampf ${name}.`;
  if (d === 1) return `Morgen ist dein Wettkampf ${name}.`;
  if (d <= 14) return `Bis zu deinem Wettkampf ${name} sind es noch ${d} Tage.`;
  return `Bis zu deinem Wettkampf ${name} sind es noch ungefähr ${Math.round(d / 7)} Wochen.`;
}

// ---------------------------------------------------------------------------
// Zusammenbau
// ---------------------------------------------------------------------------

function clampToLimit(text: string): string {
  if (text.length <= MAX_SPEECH_CHARS) return text;
  const cut = text.slice(0, MAX_SPEECH_CHARS);
  const end = cut.lastIndexOf(". ");
  return end > 0 ? cut.slice(0, end + 1) : `${cut.slice(0, MAX_SPEECH_CHARS - 1).trimEnd()}.`;
}

export function buildSpeechText(input: SpeechInput): string {
  const extras =
    input.detail === "normal"
      ? [formSentence(input.form), raceSentence(input.nextRace)].filter(Boolean)
      : [];
  const extrasText = extras.join(" ");
  const budget = MAX_SPEECH_CHARS - (extrasText ? extrasText.length + 1 : 0);
  let main: string[];

  if (input.day === "week") {
    const hasAny = input.days.some((d) => d.items.some((i) => i.sport !== "rest"));
    if (!hasAny) {
      main = ["In den nächsten sieben Tagen ist nichts geplant."];
    } else {
      const intro = "Deine nächsten sieben Tage.";
      const sentences = input.days.map((d) => weekDaySentence(input, d));
      main = [intro];
      let used = intro.length;
      for (let i = 0; i < sentences.length; i++) {
        const remaining = sentences.length - i - 1;
        // Platz für die Überlaufzeile reservieren, solange noch Tage folgen.
        const overflow = remaining > 0 ? ` Und ${remaining} weitere Tage.`.length : 0;
        if (used + 1 + sentences[i].length + overflow > budget) {
          main.push(`Und ${sentences.length - i} weitere Tage.`);
          break;
        }
        main.push(sentences[i]);
        used += 1 + sentences[i].length;
      }
    }
  } else {
    const day = input.days[0] ?? { date: input.today, items: [] };
    main = daySentences(input, day);
  }

  return clampToLimit([...main, ...extras].join(" "));
}

/** Kalendertag `YYYY-MM-DD` eines Zeitpunkts in der angegebenen Zeitzone (kein UTC-Versatz um Mitternacht). */
export function isoDateInZone(now: Date, timeZone = "Europe/Berlin"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
