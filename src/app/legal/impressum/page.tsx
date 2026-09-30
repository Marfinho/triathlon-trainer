import Link from "next/link";

export const metadata = {
  title: "Impressum · Brick",
};

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-neutral-900">
      <Link
        href="/"
        className="text-[13px] font-medium text-blue-600 transition hover:underline"
      >
        ‹ Zurück
      </Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Impressum</h1>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Platzhalter — vor dem öffentlichen Launch mit den vollständigen Angaben
        nach § 5 TMG (Name, Anschrift, ggf. USt-IdNr.) ergänzen.
      </div>

      <section className="mt-8 space-y-6 text-[15px] leading-relaxed text-neutral-900">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Angaben gemäß § 5 TMG
          </h2>
          <p className="mt-2 text-neutral-600">
            [Vor- und Nachname]
            <br />
            [Straße und Hausnummer]
            <br />
            [PLZ und Ort]
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Kontakt
          </h2>
          <p className="mt-2 text-neutral-600">
            E-Mail:{" "}
            <a
              href="mailto:svenmeendermann@gmail.com"
              className="text-blue-600 hover:underline"
            >
              svenmeendermann@gmail.com
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Verantwortlich für den Inhalt
          </h2>
          <p className="mt-2 text-neutral-600">[Vor- und Nachname], Anschrift wie oben.</p>
        </div>
      </section>
    </main>
  );
}
