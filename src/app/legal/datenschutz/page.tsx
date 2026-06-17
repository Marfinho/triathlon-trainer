import Link from "next/link";

export const metadata = {
  title: "Datenschutz · LocalHub",
};

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-[#1d1d1f]">
      <Link
        href="/"
        className="text-[13px] font-medium text-[#0071e3] transition hover:underline"
      >
        ‹ Zurück
      </Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Datenschutz</h1>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Platzhalter — vor dem öffentlichen Launch durch eine vollständige, auf
        den Betrieb zugeschnittene Datenschutzerklärung (DSGVO) ersetzen.
      </div>

      <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-[#6e6e73]">
        <section>
          <h2 className="text-base font-semibold text-[#1d1d1f]">Überblick</h2>
          <p className="mt-2">
            LocalHub verarbeitet personenbezogene Daten ausschließlich, um den
            Dienst bereitzustellen. Deine Trainingsdaten gehören dir und sind
            jederzeit exportierbar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            Welche Daten wir verarbeiten
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Konto: Name, E-Mail-Adresse, Passwort-Hash bzw. Google-Login.</li>
            <li>
              Trainingsdaten: Aktivitäten, geplante Workouts, Wellness- und
              Geräte-Daten.
            </li>
            <li>
              Integrationen: API-Keys und OAuth-Tokens (Strava, Wahoo, Withings,
              Intervals.icu) — verschlüsselt gespeichert.
            </li>
            <li>Zahlungen: über Stripe abgewickelt; wir speichern keine Kartendaten.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#1d1d1f]">Auftragsverarbeiter</h2>
          <p className="mt-2">
            Zur Bereitstellung nutzen wir Dienste wie Stripe (Zahlungen) sowie
            die von dir verbundenen Trainingsplattformen. Daten werden nur im
            erforderlichen Umfang weitergegeben.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#1d1d1f]">Deine Rechte</h2>
          <p className="mt-2">
            Du hast das Recht auf Auskunft, Berichtigung, Löschung und
            Datenübertragbarkeit. Über die Backup-/Export-Funktion kannst du
            deine Daten jederzeit vollständig exportieren. Für Anfragen:{" "}
            <a
              href="mailto:svenmeendermann@gmail.com"
              className="text-[#0071e3] hover:underline"
            >
              svenmeendermann@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
