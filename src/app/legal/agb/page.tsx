import Link from "next/link";
import { legalInfo } from "@/lib/legal";

export const metadata = { title: "AGB · Brick" };
export const dynamic = "force-dynamic";

const sections: [string, string][] = [
  ["1. Geltungsbereich", "Diese Bedingungen gelten für die Nutzung von Brick, einer Web-Anwendung zur Verwaltung und Analyse von Trainingsdaten. Mit der Registrierung kommt ein Nutzungsvertrag zustande."],
  ["2. Leistungen", "Brick stellt Werkzeuge zur Auswertung von Trainingsdaten, zur Planverwaltung und zum Datenaustausch mit externen Plattformen bereit. Es gibt einen kostenlosen und einen kostenpflichtigen Tarif; der Funktionsumfang ergibt sich aus der Preisübersicht."],
  ["3. Konto", "Du bist für die Geheimhaltung deiner Zugangsdaten verantwortlich und musst bei der Registrierung eine gültige E-Mail-Adresse angeben. Ein Konto kannst du jederzeit im Profil selbst löschen."],
  ["4. Gesundheitshinweis", "Brick ersetzt weder ärztliche Beratung noch einen Trainer. Trainingspläne, Prognosen und Ernährungswerte sind Orientierungswerte; die Umsetzung erfolgt auf eigene Verantwortung. Lass dich vor Beginn eines intensiven Trainings ärztlich untersuchen."],
  ["5. Preise und Laufzeit", "Kostenpflichtige Tarife werden über Stripe abgerechnet. Monats- und Jahresabos verlängern sich automatisch und sind jeweils zum Ende des Abrechnungszeitraums kündbar (Kundenportal im Profil). Der Lifetime-Tarif ist eine Einmalzahlung."],
  ["6. Widerrufsrecht", "Verbraucher haben ein 14-tägiges Widerrufsrecht. Beginnt die Leistung auf ausdrücklichen Wunsch vor Fristablauf, erlischt das Widerrufsrecht bei vollständiger Erbringung bzw. besteht ein Anspruch auf anteiligen Wertersatz."],
  ["7. Verfügbarkeit und Haftung", "Wir bemühen uns um hohe Verfügbarkeit, schulden aber keine ununterbrochene Erreichbarkeit. Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit; bei einfacher Fahrlässigkeit nur für die Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, typischen Schaden."],
  ["8. Änderungen", "Wir können diese Bedingungen mit angemessener Ankündigung anpassen. Widersprichst du nicht innerhalb einer gesetzten Frist, gelten die Änderungen als akzeptiert."],
];

export default function AgbPage() {
  const l = legalInfo();
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-neutral-900">
      <Link href="/" className="text-[13px] font-medium text-blue-600 transition hover:underline">‹ Zurück</Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Allgemeine Geschäftsbedingungen</h1>
      {!l.complete && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Entwurf — vor dem öffentlichen Launch rechtlich prüfen lassen und die Betreiberangaben (LEGAL_*) hinterlegen.
        </div>
      )}
      <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-neutral-600">
        <p>Anbieter: {l.name || "[Name]"}, {l.street || "[Straße]"}, {l.city || "[PLZ Ort]"}.</p>
        {sections.map(([h, t]) => (
          <section key={h}>
            <h2 className="text-base font-semibold text-neutral-900">{h}</h2>
            <p className="mt-2">{t}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
