import Link from "next/link";

export const metadata = {
  title: "Impressum · LocalHub",
};

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-[#1d1d1f]">
      <Link
        href="/"
        className="text-[13px] font-medium text-[#0071e3] transition hover:underline"
      >
        ‹ Zurück
      </Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">Impressum</h1>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Platzhalter — vor dem öffentlichen Launch mit den vollständigen Angaben
        nach § 5 TMG (Name, Anschrift, ggf. USt-IdNr.) ergänzen.
      </div>

      <section className="mt-8 space-y-6 text-[15px] leading-relaxed text-[#1d1d1f]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#86868b]">
            Angaben gemäß § 5 TMG
          </h2>
          <p className="mt-2 text-[#6e6e73]">
            [Vor- und Nachname]
            <br />
            [Straße und Hausnummer]
            <br />
            [PLZ und Ort]
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#86868b]">
            Kontakt
          </h2>
          <p className="mt-2 text-[#6e6e73]">
            E-Mail:{" "}
            <a
              href="mailto:svenmeendermann@gmail.com"
              className="text-[#0071e3] hover:underline"
            >
              svenmeendermann@gmail.com
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#86868b]">
            Verantwortlich für den Inhalt
          </h2>
          <p className="mt-2 text-[#6e6e73]">[Vor- und Nachname], Anschrift wie oben.</p>
        </div>
      </section>
    </main>
  );
}
