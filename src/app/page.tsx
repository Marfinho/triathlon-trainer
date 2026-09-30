import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import HowItWorks from "@/components/marketing/HowItWorks";
import WeekFlow from "@/components/marketing/WeekFlow";
import Pricing from "@/components/marketing/Pricing";
import { Logo } from "@/components/navigation/navItems";

type Feature = {
  title: string;
  desc: string;
  emoji: string;
  paid?: boolean;
  /** Bento-Kachel: Spannweite + Farbfläche. */
  tile: string;
};

const features: Feature[] = [
  {
    title: "KI-Schnittstelle",
    desc: "Zusammenfassung für deine KI mit einem Klick, ihr Plan wird vor dem Speichern geprüft. Du bleibst bei deiner Lieblings-KI.",
    emoji: "🤝",
    tile: "sm:col-span-2 bg-brand text-white",
  },
  {
    title: "Form & Belastung",
    desc: "CTL, ATL und TSB live berechnet — Fitness und Frische auf einen Blick.",
    emoji: "📈",
    tile: "bg-lime-pop text-ink",
  },
  {
    title: "Wettkampf-Vorhersage",
    desc: "Modellbasierte Zeitprognosen für jede Disziplin.",
    emoji: "🏁",
    paid: true,
    tile: "bg-coral text-ink",
  },
  {
    title: "Geräte-Tracking",
    desc: "Verschleiß von Schuhen, Ketten und Reifen automatisch mitführen.",
    emoji: "👟",
    tile: "bg-white text-neutral-900 border border-neutral-200",
  },
  {
    title: "Zonen & Rechner",
    desc: "Puls-, Power- und Pace-Zonen plus Rechner für FTP und Schwellen.",
    emoji: "🎯",
    tile: "bg-sky-pop text-ink",
  },
  {
    title: "Backup & Export",
    desc: "Deine Daten als CSV/JSON — kein Vendor-Lock, sie gehören dir.",
    emoji: "📦",
    paid: true,
    tile: "sm:col-span-2 lg:col-span-3 bg-sun text-ink",
  },
];

const integrations = ["Intervals.icu", "Strava", "Wahoo", "Withings", "Garmin", "Apple Health", "Polar", "COROS"];

const sports = [
  { label: "Schwimmen", emoji: "🏊", cls: "bg-sky-pop text-ink -rotate-6" },
  { label: "Rad", emoji: "🚴", cls: "bg-lime-pop text-ink rotate-3" },
  { label: "Lauf", emoji: "🏃", cls: "bg-coral text-ink -rotate-2" },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen overflow-x-hidden text-neutral-900">
      {/* Nav: schwebende Glas-Pille */}
      <header className="sticky top-3 z-50 px-3">
        <nav className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full py-2 pl-5 pr-2 shadow-[var(--shadow-card)]">
          <Link href="/" aria-label="Brick – Startseite">
            <Logo />
          </Link>
          <div className="flex items-center gap-1 text-sm font-semibold text-neutral-600 sm:gap-2">
            <a href="#features" className="hidden rounded-full px-3 py-2 transition hover:bg-neutral-100 hover:text-neutral-900 sm:block">
              Features
            </a>
            <a href="#pricing" className="hidden rounded-full px-3 py-2 transition hover:bg-neutral-100 hover:text-neutral-900 sm:block">
              Preise
            </a>
            <Link href="/auth/login" className="rounded-full px-3 py-2 transition hover:bg-neutral-100 hover:text-neutral-900">
              Anmelden
            </Link>
            <Link href="/auth/register" className="btn-pop px-4 py-2 text-sm">
              Loslegen
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative isolate mx-auto max-w-5xl px-4 pb-16 pt-14 sm:px-6 sm:pt-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="animate-blob absolute -left-10 top-10 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
          <div className="animate-blob absolute right-0 top-40 h-72 w-72 rounded-full bg-coral/20 blur-3xl [animation-delay:-6s]" />
        </div>

        <div className="text-center">
          <span className="sticker bg-white text-neutral-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Für Triathlon &amp; Ausdauersport
          </span>

          <h1 className="mx-auto mt-7 max-w-4xl text-[2.75rem] font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-7xl">
            Deine KI plant.{" "}
            <span className="text-brand">Brick</span> ist das{" "}
            <span className="relative isolate whitespace-nowrap text-ink">
              <span className="absolute inset-x-[-0.15em] bottom-[0.08em] top-[0.45em] -z-10 -rotate-1 rounded-xl bg-lime-pop" />
              Fundament.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-neutral-600">
            Brick holt deine Trainingsdaten aus Intervals.icu, gibt sie deiner KI als fertige Zusammenfassung und bringt
            ihren Trainingsplan zurück in deinen Kalender.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/register" className="btn-pop w-full px-7 py-3.5 text-[15px] sm:w-auto">
              Kostenlos starten →
            </Link>
            <a href="#so-gehts" className="btn-soft w-full px-7 py-3.5 text-[15px] sm:w-auto">
              So funktioniert’s
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {sports.map((s) => (
              <span key={s.label} className={`sticker ${s.cls}`}>
                <span aria-hidden="true">{s.emoji}</span> {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Das Prinzip als Bild */}
        <div id="so-gehts" className="mt-16 scroll-mt-24">
          <HowItWorks />
        </div>
      </section>

      {/* Ablauf eines Trainingsblocks am Beispiel Apple Watch */}
      <section id="ablauf" className="scroll-mt-24 px-4 pb-16 pt-4 sm:px-6">
        <WeekFlow />
      </section>

      {/* Integrationen: Laufband */}
      <section className="py-10" aria-label="Integrationen">
        <p className="mb-5 text-center text-sm font-semibold text-neutral-500">
          Direkt verbunden — und über Intervals.icu mit fast allem
        </p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="animate-marquee flex w-max gap-3">
            {[...integrations, ...integrations].map((name, i) => (
              <span
                key={`${name}-${i}`}
                aria-hidden={i >= integrations.length}
                className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-[15px] font-semibold text-neutral-700"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features: Bento-Grid */}
      <section id="features" className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
            Alles für dein Training <span aria-hidden="true">💪</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-neutral-600">
            Von der Synchronisation bis zur Prognose. Modular und ohne Abhängigkeiten.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className={`group relative overflow-hidden rounded-[28px] p-7 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:rotate-[-0.5deg] ${f.tile}`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-4xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" aria-hidden="true">
                    {f.emoji}
                  </span>
                  {f.paid && (
                    <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-bold text-neutral-50">PRO</span>
                  )}
                </div>
                <h3 className="mt-8 text-2xl font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed opacity-80">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl">Faire Preise</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-neutral-600">
            Starte kostenlos. Upgrade, wenn du mehr willst. Jederzeit exportierbar.
          </p>
          <div className="mt-12">
            <Pricing />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[36px] bg-ink px-6 py-16 text-center text-[#f4f2f8] sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="animate-blob absolute -left-10 -top-10 h-56 w-56 rounded-full bg-brand/60 blur-3xl" />
            <div className="animate-blob absolute -bottom-16 right-0 h-64 w-64 rounded-full bg-coral/50 blur-3xl [animation-delay:-7s]" />
          </div>
          <div className="relative">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Bereit für die nächste Saison?</h2>
            <p className="mx-auto mt-4 max-w-lg text-lg opacity-75">
              Erstelle in unter einer Minute dein kostenloses Konto.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/register"
                className="inline-flex w-full items-center justify-center rounded-full bg-lime-pop px-7 py-3.5 text-[15px] font-bold text-ink transition hover:-translate-y-0.5 active:scale-95 sm:w-auto"
              >
                Kostenlos starten →
              </Link>
              <Link href="/auth/login" className="text-[15px] font-semibold opacity-80 transition hover:opacity-100">
                Ich habe schon ein Konto
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 px-6 py-10 sm:flex-row">
          <Link href="/" aria-label="Brick – Startseite">
            <Logo />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-neutral-500">
            <Link href="/legal/impressum" className="transition hover:text-neutral-900">
              Impressum
            </Link>
            <Link href="/legal/datenschutz" className="transition hover:text-neutral-900">
              Datenschutz
            </Link>
            <a href="mailto:svenmeendermann@gmail.com" className="transition hover:text-neutral-900">
              Kontakt
            </a>
          </div>
        </div>
        <p className="pb-10 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} Brick. Deine Daten gehören dir.
        </p>
      </footer>
    </div>
  );
}
