import { describe, it, expect } from "vitest";
import {
  MAX_SPEECH_CHARS,
  buildSpeechText,
  formatDurationSpeech,
  isoDateInZone,
  sanitizeSpeech,
  type SpeechInput,
  type VoiceItem,
} from "@/lib/voice/summary";

const TODAY = "2026-10-07"; // Mittwoch
const item = (sport: string, durationMin: number, status: VoiceItem["status"] = "planned", title = ""): VoiceItem => ({
  sport,
  title,
  durationMin,
  status,
});
const base = (over: Partial<SpeechInput> & { items?: VoiceItem[] }): SpeechInput => ({
  day: "today",
  detail: "short",
  today: TODAY,
  days: [{ date: TODAY, items: over.items ?? [] }],
  ...over,
});

describe("formatDurationSpeech", () => {
  it("formuliert Minuten und Stunden", () => {
    expect(formatDurationSpeech(36)).toBe("36 Minuten");
    expect(formatDurationSpeech(1)).toBe("1 Minute");
    expect(formatDurationSpeech(60)).toBe("1 Stunde");
    expect(formatDurationSpeech(80)).toBe("1 Stunde 20");
    expect(formatDurationSpeech(120)).toBe("2 Stunden");
    expect(formatDurationSpeech(0)).toBe("");
  });
});

describe("sanitizeSpeech", () => {
  it("entfernt Sonderzeichen und kürzt an der Wortgrenze", () => {
    expect(sanitizeSpeech("Rad (Z2) – 4x10' @ 280W / locker!")).toBe("Rad Z2 4x10 280W locker");
    expect(sanitizeSpeech("Hin & Her")).toBe("Hin und Her");
    expect(sanitizeSpeech("<script>alert(1)</script>")).toBe("script alert 1 script");
    const long = sanitizeSpeech("Grundlagenausdauer ".repeat(10));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith(" ")).toBe(false);
    expect(sanitizeSpeech(null)).toBe("");
  });
});

describe("buildSpeechText – ein Tag", () => {
  it("nichts geplant / Ruhetag", () => {
    expect(buildSpeechText(base({}))).toBe("Heute ist nichts geplant.");
    expect(buildSpeechText(base({ items: [item("rest", 0)] }))).toBe("Heute ist Ruhetag.");
    expect(
      buildSpeechText({ ...base({}), day: "tomorrow", days: [{ date: "2026-10-08", items: [] }] }),
    ).toBe("Morgen ist nichts geplant.");
  });

  it("eine Einheit", () => {
    expect(buildSpeechText(base({ items: [item("bike", 80)] }))).toBe("Heute steht Radfahren für 1 Stunde 20 auf dem Plan.");
    expect(buildSpeechText(base({ items: [item("run", 36)] }))).toBe("Heute steht Laufen für 36 Minuten auf dem Plan.");
  });

  it("mehrere Einheiten, bei vielen mit „und N weitere“", () => {
    expect(buildSpeechText(base({ items: [item("run", 45), item("strength", 30)] }))).toBe(
      "Heute stehen zwei Einheiten an: Laufen für 45 Minuten und Krafttraining für 30 Minuten.",
    );
    const many = buildSpeechText(
      base({ items: [item("run", 30), item("bike", 60), item("swim", 40), item("strength", 20), item("mobility", 10)] }),
    );
    expect(many).toContain("fünf Einheiten");
    expect(many).toContain("und 2 weitere.");
  });

  it("bereits erledigt", () => {
    expect(buildSpeechText(base({ items: [item("bike", 60, "done")] }))).toBe("Das Radtraining hast du schon gemacht.");
    expect(buildSpeechText(base({ items: [item("bike", 60, "done"), item("run", 30, "done")] }))).toBe(
      "Das Radtraining und das Lauftraining hast du schon gemacht.",
    );
    expect(buildSpeechText(base({ items: [item("run", 45), item("bike", 60, "done")] }))).toBe(
      "Heute steht noch Laufen für 45 Minuten auf dem Plan. Das Radtraining hast du schon gemacht.",
    );
  });

  it("Titel nur bei normal, bereinigt und nicht doppelt", () => {
    const items = [item("bike", 60, "planned", "Sweetspot (3x15') @ 90%")];
    expect(buildSpeechText(base({ items }))).not.toContain("Sweetspot");
    const normal = buildSpeechText(base({ detail: "normal", items }));
    expect(normal).toContain("Die Einheit heißt Sweetspot 3x15 90.");
    expect(buildSpeechText(base({ detail: "normal", items: [item("run", 30, "planned", "Laufen")] }))).not.toContain("heißt");
  });
});

describe("buildSpeechText – normal", () => {
  it("ergänzt Form und Wettkampf-Countdown, aber nie Gesundheitsdetails", () => {
    const text = buildSpeechText(
      base({
        detail: "normal",
        items: [item("run", 45)],
        form: { state: "optimal" },
        nextRace: { name: "Ironman 70.3 Kraichgau", daysToRace: 45 },
      }),
    );
    expect(text).toContain("Du bist gut erholt.");
    expect(text).toContain("Bis zu deinem Wettkampf Ironman 70 3 Kraichgau sind es noch ungefähr 6 Wochen.");
    expect(text).not.toMatch(/schmerz|verletz|hrv|puls|ruhepuls|schlaf/i);
    const short = buildSpeechText(
      base({ items: [item("run", 45)], form: { state: "optimal" }, nextRace: { name: "X", daysToRace: 3 } }),
    );
    expect(short).toBe("Heute steht Laufen für 45 Minuten auf dem Plan.");
  });

  it("Countdown kurz vor und am Wettkampf", () => {
    const t = (d: number) => buildSpeechText(base({ detail: "normal", nextRace: { name: "Cup", daysToRace: d } }));
    expect(t(10)).toContain("noch 10 Tage");
    expect(t(1)).toContain("Morgen ist dein Wettkampf Cup.");
    expect(t(0)).toContain("Heute ist dein Wettkampf Cup.");
    expect(t(-3)).toBe("Heute ist nichts geplant.");
  });
});

describe("buildSpeechText – Woche", () => {
  const days = (n: number, per: (i: number) => VoiceItem[]) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-10-${String(7 + i).padStart(2, "0")}`,
      items: per(i),
    }));

  it("knappe Übersicht je Tag mit Heute, Morgen und Wochentagen", () => {
    const text = buildSpeechText({
      day: "week",
      detail: "short",
      today: TODAY,
      days: days(7, (i) =>
        [[item("bike", 60, "done")], [item("run", 45)], [], [item("swim", 40), item("strength", 30)], [item("rest", 0)], [], []][i],
      ),
    });
    expect(text).toBe(
      "Deine nächsten sieben Tage. Heute Radfahren erledigt. Morgen Laufen für 45 Minuten. Freitag frei. " +
        "Samstag Schwimmen für 40 Minuten und Krafttraining für 30 Minuten. Sonntag Ruhetag. Montag frei. Dienstag frei.",
    );
  });

  it("leere Woche", () => {
    expect(buildSpeechText({ day: "week", detail: "short", today: TODAY, days: days(7, () => []) })).toBe(
      "In den nächsten sieben Tagen ist nichts geplant.",
    );
  });

  it("bleibt unter dem Zeichenlimit und meldet den Rest", () => {
    const text = buildSpeechText({
      day: "week",
      detail: "normal",
      today: TODAY,
      days: days(7, () => [item("run", 45), item("bike", 90), item("swim", 30), item("strength", 20)]),
      form: { state: "tired" },
      nextRace: { name: "Ironman Frankfurt", daysToRace: 20 },
    });
    expect(text.length).toBeLessThanOrEqual(MAX_SPEECH_CHARS);
    expect(text).toMatch(/Und \d weitere Tage\./);
    expect(text).toContain("Wettkampf Ironman Frankfurt");
  });
});

describe("Sprechbarkeit und Determinismus", () => {
  it("enthält keine Klammern/Sonderzeichen und ist deterministisch", () => {
    const input = base({
      detail: "normal",
      items: [item("brick", 95, "planned", "Koppel (Rad/Lauf) #1 <b>!</b>"), item("walk", 20)],
      form: { state: "neutral" },
      nextRace: { name: "Trilogy (Sprint) 2027", daysToRace: 100 },
    });
    const a = buildSpeechText(input);
    expect(buildSpeechText(input)).toBe(a);
    expect(a).not.toMatch(/[()<>#/@%&*_[\]{}|\\]/);
    expect(a.length).toBeLessThanOrEqual(MAX_SPEECH_CHARS);
  });
});

describe("isoDateInZone", () => {
  it("nutzt den lokalen Kalendertag statt UTC um Mitternacht", () => {
    // 23:30 UTC am 6.10. = 01:30 MESZ am 7.10.
    expect(isoDateInZone(new Date("2026-10-06T23:30:00Z"))).toBe("2026-10-07");
    // Winterzeit: 23:30 UTC = 00:30 MEZ
    expect(isoDateInZone(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(isoDateInZone(new Date("2026-10-07T10:00:00Z"))).toBe("2026-10-07");
  });
});
