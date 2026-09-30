/**
 * Das Prinzip von Brick als Bild: Intervals.icu liefert die Daten, die KI
 * schreibt den Plan, Brick ist das Fundament dazwischen.
 */

const dataChips = ["Aktivitäten", "Belastung", "Puls", "Watt", "Pace"];
const ownChips = ["Check-ins", "Schmerzen", "Körperdaten", "Wettkämpfe"];
const aiChips = ["ChatGPT", "Claude", "Gemini", "…"];

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0" aria-hidden="true">
      <div className="flex flex-col items-center gap-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-lg font-bold text-neutral-50 shadow-lg">
          <span className="rotate-90 lg:rotate-0">→</span>
        </span>
        <span className="font-display text-[11px] text-neutral-500">{label}</span>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1.15fr_auto_1fr]">
        {/* Daten */}
        <div className="card-neon rounded-[28px] p-6 text-left">
          <p className="font-display text-[11px] uppercase tracking-[0.14em] text-neutral-500">Die Daten</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">Intervals.icu</h3>
          <p className="mt-1 text-sm text-neutral-600">Alles, was deine Uhr und dein Radcomputer aufzeichnen.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {dataChips.map((c) => (
              <span key={c} className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                {c}
              </span>
            ))}
          </div>
        </div>

        <Arrow label="holt alles" />

        {/* Brick */}
        <div className="relative rounded-[32px] bg-brand p-7 text-left text-white shadow-[var(--shadow-card-hover)] lg:-rotate-1">
          <span className="absolute -right-2 -top-3 rotate-6 rounded-full bg-lime-pop px-3 py-1 text-xs font-bold text-ink shadow-md">
            das Fundament
          </span>
          <p className="font-display text-[11px] uppercase tracking-[0.14em] opacity-75">Das Gerüst</p>
          <h3 className="mt-1 text-3xl font-extrabold tracking-tight">Brick</h3>
          <p className="mt-2 text-[15px] leading-relaxed opacity-90">
            Sammelt alles an einem Ort, macht daraus eine fertige Zusammenfassung für deine KI und prüft den Plan,
            bevor er in deinem Kalender landet.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ownChips.map((c) => (
              <span key={c} className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">
                + {c}
              </span>
            ))}
          </div>
        </div>

        <Arrow label="fragt" />

        {/* KI */}
        <div className="card-neon rounded-[28px] p-6 text-left">
          <p className="font-display text-[11px] uppercase tracking-[0.14em] text-neutral-500">Der Coach</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">Deine KI</h3>
          <p className="mt-1 text-sm text-neutral-600">Liest deine Daten und schreibt den Trainingsplan.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {aiChips.map((c) => (
              <span key={c} className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-semibold text-pink-800">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Rückweg */}
      <div className="mt-3 flex flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-neutral-300 px-6 py-5 text-center sm:flex-row sm:text-left">
        <span
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-lime-pop text-xl font-bold text-ink"
          aria-hidden="true"
        >
          ↩
        </span>
        <p className="text-[15px] text-neutral-700">
          <strong className="text-neutral-900">Der Plan kommt zurück:</strong> Brick trägt ihn in deinen Kalender ein und
          schickt die Einheiten an Intervals.icu, von dort auf Garmin, Wahoo &amp; Co. Nach dem Training siehst du Soll
          und Ist, und die nächste Runde beginnt.
        </p>
      </div>
    </div>
  );
}
