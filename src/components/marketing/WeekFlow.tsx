/**
 * Kurzer Ablauf eines Trainingsblocks am Beispiel Apple Watch + Intervals.icu
 * Companion. Die Schritte sind eine echte Reihenfolge, daher nummeriert.
 */

type Step = {
  where: string;
  title: string;
  text: string;
  /** Farbe der Nummer (Tailwind-Klassen). */
  dot: string;
};

const steps: Step[] = [
  {
    where: "Einmalig",
    title: "Verbinden",
    text: "Intervals.icu Companion aufs iPhone laden und mit Intervals.icu koppeln. In Brick einmal Intervals.icu verbinden.",
    dot: "bg-neutral-900 text-neutral-50",
  },
  {
    where: "Brick → KI",
    title: "Fragen",
    text: "Unter „Coach“ die Planlänge wählen, von 1 bis 12 Wochen. Auf „Erzeugen“ tippen, die Zusammenfassung kopieren und in deine KI einfügen.",
    dot: "bg-brand text-white",
  },
  {
    where: "KI → Brick",
    title: "Plan übernehmen",
    text: "Die Antwort der KI in Brick einfügen. „Prüfen“ zeigt dir die Vorschau, „Übernehmen“ trägt die Einheiten in den Kalender ein.",
    dot: "bg-bubblegum text-ink",
  },
  {
    where: "Apple Watch",
    title: "Trainieren",
    text: "Brick schickt die Einheiten an Intervals.icu, Companion holt sie auf die Watch. Du startest das Workout wie gewohnt.",
    dot: "bg-sky-pop text-ink",
  },
  {
    where: "Watch → Brick",
    title: "Vergleichen",
    text: "Companion lädt das Workout zu Intervals.icu, Brick holt es ab. Du siehst Soll und Ist. Ist der Plan durch, geht es bei Schritt 2 weiter.",
    dot: "bg-lime-pop text-ink",
  },
];

function WatchIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="3.5" />
      <path d="M9 6l.6-3h4.8l.6 3M9 18l.6 3h4.8l.6-3M12 9.5V12l1.5 1" />
    </svg>
  );
}

export default function WeekFlow() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center text-center">
        <span className="sticker bg-white text-neutral-700">
          <WatchIcon /> Beispiel mit Apple Watch
        </span>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">So läuft ein Trainingsblock</h2>
        <p className="mt-4 max-w-xl text-lg text-neutral-600">
          Für die Apple Watch brauchst du die App Intervals.icu Companion. Mit Garmin oder Wahoo geht es genauso, nur
          ohne Extra-App.
        </p>
      </div>

      <ol className="relative mt-12 grid gap-3 lg:grid-cols-5">
        {/* Verbindungslinie (nur Desktop) */}
        <span
          aria-hidden="true"
          className="absolute left-[10%] right-[10%] top-[34px] hidden h-0.5 bg-[repeating-linear-gradient(90deg,var(--color-neutral-300)_0_8px,transparent_8px_14px)] lg:block"
        />
        {steps.map((s, i) => (
          <li key={s.title} className="card-neon relative flex gap-4 rounded-[28px] p-5 lg:flex-col lg:gap-3">
            <span
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-display-sans)] text-lg font-extrabold ${s.dot}`}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[11px] uppercase tracking-[0.12em] text-neutral-500">{s.where}</p>
              <h3 className="mt-0.5 text-lg font-bold tracking-tight">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
