import Link from "next/link";
import { legalInfo } from "@/lib/legal";

export const metadata = { title: "Impressum · Brick" };
export const dynamic = "force-dynamic";

export default function ImpressumPage() {
  const l = legalInfo();
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-neutral-900">
      <Link href="/" className="text-[13px] font-medium text-blue-600 transition hover:underline">‹ Zurück</Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Impressum</h1>

      {!l.complete && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Angaben unvollständig — vor dem öffentlichen Launch die Umgebungsvariablen
          LEGAL_NAME, LEGAL_STREET, LEGAL_CITY und LEGAL_EMAIL setzen (siehe DEPLOY.md).
        </div>
      )}

      <section className="mt-8 space-y-6 text-[15px] leading-relaxed text-neutral-900">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Angaben gemäß § 5 DDG</h2>
          <p className="mt-2 text-neutral-600">
            {l.name || "[Vor- und Nachname]"}<br />
            {l.street || "[Straße und Hausnummer]"}<br />
            {l.city || "[PLZ und Ort]"}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Kontakt</h2>
          <p className="mt-2 text-neutral-600">
            E-Mail:{" "}
            <a href={`mailto:${l.email || "kontakt@example.com"}`} className="text-blue-600 hover:underline">{l.email || "[E-Mail]"}</a>
            {l.phone && <><br />Telefon: {l.phone}</>}
          </p>
        </div>
        {l.vatId && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Umsatzsteuer-ID</h2>
            <p className="mt-2 text-neutral-600">{l.vatId}</p>
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Verantwortlich für den Inhalt</h2>
          <p className="mt-2 text-neutral-600">{l.name || "[Vor- und Nachname]"}, Anschrift wie oben.</p>
        </div>
      </section>
    </main>
  );
}
