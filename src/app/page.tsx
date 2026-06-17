import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import PmcHeroChart from "@/components/marketing/PmcHeroChart";
import Pricing from "@/components/marketing/Pricing";

type Feature = {
  title: string;
  desc: string;
  paid?: boolean;
};

const features: Feature[] = [
  {
    title: "Aktivitäten-Sync",
    desc: "Schwimmen, Rad und Lauf laufen automatisch über Intervals.icu zusammen.",
  },
  {
    title: "Form & Belastung",
    desc: "CTL, ATL und TSB live berechnet — Fitness und Frische auf einen Blick.",
  },
  {
    title: "Wettkampf-Vorhersage",
    desc: "Modellbasierte Zeitprognosen für jede Disziplin.",
    paid: true,
  },
  {
    title: "Geräte-Tracking",
    desc: "Verschleiß von Schuhen, Ketten und Reifen automatisch mitführen.",
  },
  {
    title: "Zonen & Rechner",
    desc: "Puls-, Power- und Pace-Zonen plus Rechner für FTP und Schwellen.",
  },
  {
    title: "Backup & Export",
    desc: "Deine Daten als CSV/JSON — kein Vendor-Lock, sie gehören dir.",
    paid: true,
  },
];

const activeIntegrations = ["Intervals.icu", "Strava", "Wahoo", "Withings"];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[#e8e8ed] bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-1.5 text-[17px] font-semibold tracking-tight">
            LocalHub
            <span className="h-1.5 w-1.5 rounded-full bg-[#0071e3]" />
          </Link>
          <div className="flex items-center gap-7 text-[13px] text-[#6e6e73]">
            <a href="#features" className="hidden transition hover:text-[#1d1d1f] sm:block">
              Features
            </a>
            <a href="#pricing" className="hidden transition hover:text-[#1d1d1f] sm:block">
              Preise
            </a>
            <Link href="/auth/login" className="transition hover:text-[#1d1d1f]">
              Anmelden
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-20 text-center sm:pt-28">
        <h1 className="mx-auto max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Deine Trainingsdaten.
          <br />
          <span className="text-[#6e6e73]">An einem Ort.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#6e6e73]">
          LocalHub bündelt Schwimmen, Rad und Lauf in einer Datendrehscheibe.
          Verfolge Form &amp; Belastung, erhalte Wettkampf-Vorhersagen — und
          behalte die volle Kontrolle über deine Daten.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register"
            className="rounded-full bg-[#0071e3] px-7 py-3 text-[15px] font-medium text-white transition hover:bg-[#0077ed]"
          >
            Kostenlos starten
          </Link>
          <a
            href="#features"
            className="text-[15px] font-medium text-[#0071e3] transition hover:underline"
          >
            Mehr erfahren ›
          </a>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <PmcHeroChart />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-[#f5f5f7]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="text-center text-4xl font-semibold tracking-tight">
            Alles für dein Training
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-[#6e6e73]">
            Von der Synchronisation bis zur Prognose. Modular und ohne
            Abhängigkeiten.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#e8e8ed] bg-[#e8e8ed] sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-white p-7">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                  {f.paid && (
                    <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[11px] font-medium text-[#6e6e73]">
                      Pro
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-[#6e6e73]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h2 className="text-4xl font-semibold tracking-tight">Verbunden mit allem</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[#6e6e73]">
          Direkt angebunden — und über Intervals.icu erreichst du Garmin, Apple
          Health, Polar, COROS und mehr.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {activeIntegrations.map((name) => (
            <span
              key={name}
              className="rounded-full border border-[#d2d2d7] px-5 py-2 text-[15px] font-medium text-[#1d1d1f]"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 bg-[#f5f5f7]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="text-center text-4xl font-semibold tracking-tight">Preise</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-[#6e6e73]">
            Starte kostenlos. Upgrade, wenn du mehr willst. Jederzeit
            exportierbar.
          </p>
          <div className="mt-14">
            <Pricing />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-28 text-center">
        <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Jetzt loslegen
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-[#6e6e73]">
          Erstelle in unter einer Minute dein kostenloses Konto.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register"
            className="rounded-full bg-[#0071e3] px-7 py-3 text-[15px] font-medium text-white transition hover:bg-[#0077ed]"
          >
            Kostenlos starten
          </Link>
          <Link
            href="/auth/login"
            className="text-[15px] font-medium text-[#0071e3] transition hover:underline"
          >
            Anmelden ›
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e8e8ed]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 px-6 py-10 sm:flex-row">
          <Link href="/" className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            LocalHub
            <span className="h-1.5 w-1.5 rounded-full bg-[#0071e3]" />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-[#6e6e73]">
            <Link href="/legal/impressum" className="transition hover:text-[#1d1d1f]">
              Impressum
            </Link>
            <Link href="/legal/datenschutz" className="transition hover:text-[#1d1d1f]">
              Datenschutz
            </Link>
            <a href="mailto:svenmeendermann@gmail.com" className="transition hover:text-[#1d1d1f]">
              Kontakt
            </a>
          </div>
        </div>
        <p className="pb-10 text-center text-[12px] text-[#a1a1a6]">
          © {new Date().getFullYear()} LocalHub. Deine Daten gehören dir.
        </p>
      </footer>
    </div>
  );
}
