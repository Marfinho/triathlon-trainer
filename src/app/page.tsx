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
    <div className="min-h-screen bg-transparent text-[#F1F1FB]">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[#27273B] bg-white/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-1.5 text-[17px] font-semibold tracking-tight">
            LocalHub
            <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF]" />
          </Link>
          <div className="flex items-center gap-7 text-[13px] text-[#9A9AB8]">
            <a href="#features" className="hidden transition hover:text-[#F1F1FB] sm:block">
              Features
            </a>
            <a href="#pricing" className="hidden transition hover:text-[#F1F1FB] sm:block">
              Preise
            </a>
            <Link href="/auth/login" className="transition hover:text-[#F1F1FB]">
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
          <span className="bg-gradient-to-r from-[#00E5FF] via-[#7C4DFF] to-[#FF2BD6] bg-clip-text text-transparent">An einem Ort.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#9A9AB8]">
          LocalHub bündelt Schwimmen, Rad und Lauf in einer Datendrehscheibe.
          Verfolge Form &amp; Belastung, erhalte Wettkampf-Vorhersagen — und
          behalte die volle Kontrolle über deine Daten.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register"
            className="rounded-full bg-[#00E5FF] px-7 py-3 text-[15px] font-medium text-white transition hover:bg-[#00C8FF]"
          >
            Kostenlos starten
          </Link>
          <a
            href="#features"
            className="text-[15px] font-medium text-[#00E5FF] transition hover:underline"
          >
            Mehr erfahren ›
          </a>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <PmcHeroChart />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-[#07070D]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="text-center text-4xl font-semibold tracking-tight">
            Alles für dein Training
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-[#9A9AB8]">
            Von der Synchronisation bis zur Prognose. Modular und ohne
            Abhängigkeiten.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[#27273B] bg-[#27273B] sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-white p-7">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                  {f.paid && (
                    <span className="rounded-full bg-[#07070D] px-2 py-0.5 text-[11px] font-medium text-[#9A9AB8]">
                      Pro
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-[#9A9AB8]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h2 className="text-4xl font-semibold tracking-tight">Verbunden mit allem</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[#9A9AB8]">
          Direkt angebunden — und über Intervals.icu erreichst du Garmin, Apple
          Health, Polar, COROS und mehr.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {activeIntegrations.map((name) => (
            <span
              key={name}
              className="rounded-full border border-[#34344D] px-5 py-2 text-[15px] font-medium text-[#F1F1FB]"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 bg-[#07070D]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="text-center text-4xl font-semibold tracking-tight">Preise</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-[#9A9AB8]">
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
        <p className="mx-auto mt-4 max-w-lg text-lg text-[#9A9AB8]">
          Erstelle in unter einer Minute dein kostenloses Konto.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/register"
            className="rounded-full bg-[#00E5FF] px-7 py-3 text-[15px] font-medium text-white transition hover:bg-[#00C8FF]"
          >
            Kostenlos starten
          </Link>
          <Link
            href="/auth/login"
            className="text-[15px] font-medium text-[#00E5FF] transition hover:underline"
          >
            Anmelden ›
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#27273B]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-5 px-6 py-10 sm:flex-row">
          <Link href="/" className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            LocalHub
            <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF]" />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-[#9A9AB8]">
            <Link href="/legal/impressum" className="transition hover:text-[#F1F1FB]">
              Impressum
            </Link>
            <Link href="/legal/datenschutz" className="transition hover:text-[#F1F1FB]">
              Datenschutz
            </Link>
            <a href="mailto:svenmeendermann@gmail.com" className="transition hover:text-[#F1F1FB]">
              Kontakt
            </a>
          </div>
        </div>
        <p className="pb-10 text-center text-[12px] text-[#A9A9C4]">
          © {new Date().getFullYear()} LocalHub. Deine Daten gehören dir.
        </p>
      </footer>
    </div>
  );
}
