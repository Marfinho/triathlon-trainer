import Link from "next/link";
import { legalInfo } from "@/lib/legal";

export const metadata = {
  title: "Datenschutz · Brick",
};

export const dynamic = "force-dynamic";

export default function DatenschutzPage() {
  const l = legalInfo();
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-neutral-900">
      <Link
        href="/"
        className="text-[13px] font-medium text-blue-600 transition hover:underline"
      >
        ‹ Zurück
      </Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Datenschutz</h1>

      {!l.complete && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Entwurf — vor dem öffentlichen Launch rechtlich prüfen lassen und die Betreiberangaben (LEGAL_*) hinterlegen.
        </div>
      )}

      <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-neutral-600">
        <section>
          <h2 className="text-base font-semibold text-neutral-900">Überblick</h2>
          <p className="mt-2">
            Brick verarbeitet personenbezogene Daten ausschließlich, um den
            Dienst bereitzustellen. Deine Trainingsdaten gehören dir und sind
            jederzeit exportierbar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">
            Welche Daten wir verarbeiten
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Konto: Name, E-Mail-Adresse, Passwort-Hash bzw. Google-Login, Zeitpunkt der Zustimmung zu AGB/Datenschutz.</li>
            <li>Sicherheits-Protokolle: Anmelde- und Kontoereignisse mit IP-Adresse (zur Abwehr von Missbrauch).</li>
            <li>E-Mail-Versand: Bestätigungs-, Willkommens- und Passwort-Reset-Mails über einen SMTP-Dienstleister.</li>
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
          <h2 className="text-base font-semibold text-neutral-900">Auftragsverarbeiter</h2>
          <p className="mt-2">
            Zur Bereitstellung nutzen wir Dienste wie Stripe (Zahlungen) sowie
            die von dir verbundenen Trainingsplattformen. Daten werden nur im
            erforderlichen Umfang weitergegeben.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Verantwortlicher</h2>
          <p className="mt-2">
            {l.name || "[Name]"}, {l.street || "[Straße]"}, {l.city || "[PLZ Ort]"}, E-Mail: {l.email || "[E-Mail]"}.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Rechtsgrundlagen und Speicherdauer</h2>
          <p className="mt-2">
            Kontodaten verarbeiten wir zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO), Sicherheits-Protokolle aufgrund
            berechtigten Interesses (lit. f). Gesundheits- und Ernährungsdaten nur mit deiner ausdrücklichen Einwilligung
            (Art. 9 Abs. 2 lit. a). Wir speichern Daten, bis du dein Konto löschst; die Löschung ist im Profil jederzeit möglich
            und entfernt alle Daten. Gesetzliche Aufbewahrungspflichten (z. B. für Zahlungsbelege) bleiben unberührt.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Cookies</h2>
          <p className="mt-2">
            Wir setzen ausschließlich technisch notwendige Cookies (Sitzung/Anmeldung). Tracking- oder Werbe-Cookies gibt es nicht.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Deine Rechte</h2>
          <p className="mt-2">
            Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und
            Datenübertragbarkeit sowie ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde. Über die Backup-/Export-Funktion kannst du
            deine Daten jederzeit vollständig exportieren. Für Anfragen:{" "}
            <a
              href={`mailto:${l.email}`}
              className="text-blue-600 hover:underline"
            >
              {l.email || "[E-Mail]"}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
