import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import PmcHeroChart from "@/components/marketing/PmcHeroChart";
import Pricing from "@/components/marketing/Pricing";
import AuthTabs from "@/components/marketing/AuthTabs";

type Feature = {
  icon: string;
  title: string;
  desc: string;
  tier: "Free" | "Paid";
};

const features: Feature[] = [
  {
    icon: "🔄",
    title: "Intervals.icu-Sync",
    desc: "Aktivitäten, Wellness und Workouts automatisch aus Intervals.icu importieren.",
    tier: "Free",
  },
  {
    icon: "📈",
    title: "Form & Belastung",
    desc: "CTL, ATL und TSB live berechnet — sieh Fitness und Frische auf einen Blick.",
    tier: "Free",
  },
  {
    icon: "🏁",
    title: "Wettkampf-Vorhersage",
    desc: "Modellbasierte Zeitprognosen für Schwimmen, Rad und Lauf auf Basis deiner Daten.",
    tier: "Paid",
  },
  {
    icon: "⌚",
    title: "Geräte-Tracking",
    desc: "Verschleiß von Laufschuhen, Ketten und Reifen automatisch mitführen.",
    tier: "Free",
  },
  {
    icon: "🎯",
    title: "Trainingszonen & Rechner",
    desc: "Puls-, Power- und Pace-Zonen plus Rechner für FTP, Schwellen und mehr.",
    tier: "Free",
  },
  {
    icon: "💾",
    title: "Backup & Export",
    desc: "Vollständiger Export deiner Daten als CSV/JSON — kein Vendor-Lock, dir gehören sie.",
    tier: "Paid",
  },
];

const metrics = [
  { value: "15+", label: "Integrationen" },
  { value: "3", label: "Sportarten" },
  { value: "∞", label: "Datenpunkte (Paid)" },
  { value: "0", label: "Vendor-Lock" },
];

const activeIntegrations = ["Intervals.icu", "Apple Health", "Withings", "Strava"];
const plannedIntegrations = [
  "Garmin",
  "Polar",
  "COROS",
  "Wahoo",
  "TrainingPeaks",
  "Suunto",
  "Zwift",
  "Oura",
  "Whoop",
];

function TierPill({ tier }: { tier: "Free" | "Paid" }) {
  if (tier === "Paid") {
    return (
      <span className="rounded-full bg-[#F0A500] px-2 py-0.5 font-display text-[10px] font-medium uppercase tracking-wider text-[#0B1120]">
        Paid
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[#94A3B8] px-2 py-0.5 font-display text-[10px] font-medium uppercase tracking-wider text-[#94A3B8]">
      Free
    </span>
  );
}

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0B1120] text-[#F8FAFC]">
      {/* a) Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-[#1E293B] bg-[#0B1120]/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-lg font-medium">LocalHub</span>
            <span className="h-2 w-2 rounded-full bg-[#F0A500]" />
          </Link>

          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 text-sm text-[#94A3B8] md:flex">
              <a href="#features" className="transition hover:text-[#F8FAFC]">
                Features
              </a>
              <a href="#pricing" className="transition hover:text-[#F8FAFC]">
                Pricing
              </a>
              <a href="#auth" className="transition hover:text-[#F8FAFC]">
                Login
              </a>
            </div>
            <Link
              href="/auth/register"
              className="rounded-lg bg-[#F0A500] px-4 py-2 text-sm font-medium text-[#0B1120] transition hover:bg-[#ffb81f]"
            >
              Kostenlos starten
            </Link>
          </div>
        </nav>
      </header>

      {/* b) Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              Deine Triathlon-Trainingsdaten{" "}
              <span className="text-[#F0A500]">an einem Ort.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-[#94A3B8]">
              LocalHub bündelt Schwimmen, Rad und Lauf in einer Datendrehscheibe.
              Verfolge Form &amp; Belastung (CTL/ATL/TSB), erhalte
              Wettkampf-Vorhersagen — und behalte die volle Kontrolle: kein
              Vendor-Lock, deine Daten exportierbar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/register"
                className="rounded-lg bg-[#F0A500] px-6 py-3 text-center font-medium text-[#0B1120] transition hover:bg-[#ffb81f]"
              >
                Kostenlos starten
              </Link>
              <a
                href="#features"
                className="rounded-lg border border-[#334155] px-6 py-3 text-center font-medium text-[#F8FAFC] transition hover:border-[#475569]"
              >
                Features ansehen
              </a>
            </div>
          </div>

          {/* Chart hidden on mobile */}
          <div className="hidden md:block">
            <PmcHeroChart />
          </div>
        </div>
      </section>

      {/* c) Metrics strip */}
      <section className="border-y border-[#1E293B] bg-[#111827]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="text-center">
              <div className="font-display text-3xl font-medium text-[#F0A500]">
                {m.value}
              </div>
              <div className="mt-1 font-display text-xs uppercase tracking-wider text-[#94A3B8]">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* d) Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Alles für dein Training
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[#94A3B8]">
          Von der Datensynchronisation bis zur Wettkampf-Prognose — modular und
          ohne Abhängigkeiten.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col rounded-2xl border border-[#1E293B] bg-[#111827] p-6 transition hover:border-[#334155]"
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl" aria-hidden="true">
                  {f.icon}
                </span>
                <TierPill tier={f.tier} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[#94A3B8]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* e) Integrations */}
      <section className="border-y border-[#1E293B] bg-[#111827]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Integrationen
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[#94A3B8]">
            Verbinde deine Geräte und Plattformen. Aktiv heute, mehr in Planung.
          </p>

          <div className="mt-8">
            <div className="mb-2 font-display text-xs uppercase tracking-wider text-[#94A3B8]">
              Aktiv
            </div>
            <div className="flex flex-wrap gap-2">
              {activeIntegrations.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-[#F0A500] px-4 py-1.5 text-sm text-[#F8FAFC]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 font-display text-xs uppercase tracking-wider text-[#94A3B8]">
              In Planung
            </div>
            <div className="flex flex-wrap gap-2">
              {plannedIntegrations.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-[#334155] px-4 py-1.5 text-sm text-[#94A3B8]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* f) Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Preise</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[#94A3B8]">
          Starte kostenlos. Upgrade, wenn du mehr willst. Jederzeit exportierbar.
        </p>
        <div className="mt-12">
          <Pricing />
        </div>
      </section>

      {/* g) Auth */}
      <section
        id="auth"
        className="scroll-mt-20 border-y border-[#1E293B] bg-[#111827]"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">
            Jetzt loslegen
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[#94A3B8]">
            Melde dich an oder erstelle ein kostenloses Konto.
          </p>
          <div className="mt-12">
            <AuthTabs />
          </div>
        </div>
      </section>

      {/* h) Footer */}
      <footer className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 border-t border-[#1E293B] pt-8 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-base font-medium">LocalHub</span>
            <span className="h-2 w-2 rounded-full bg-[#F0A500]" />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#94A3B8]">
            <a href="#" className="transition hover:text-[#F8FAFC]">
              Datenschutz
            </a>
            <a href="#" className="transition hover:text-[#F8FAFC]">
              AGB
            </a>
            <a href="#" className="transition hover:text-[#F8FAFC]">
              Impressum
            </a>
            <a href="#" className="transition hover:text-[#F8FAFC]">
              Kontakt
            </a>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-[#475569]">
          © {new Date().getFullYear()} LocalHub. Deine Daten gehören dir.
        </p>
      </footer>
    </div>
  );
}
