import Link from "next/link";

/** Amber-umrandete Karte mit Feature-Beschreibung + Upgrade-CTA (FEATURE-GATE). */
export function UpgradeCard({
  title,
  description,
  cta = "Auf Pro upgraden",
}: {
  title: string;
  description: string;
  cta?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#FF2BD6]/40 bg-[#FF2BD6]/5 p-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#FF2BD6]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF6FE6]">
          Ab Pro verfügbar
        </span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      <Link
        href="/#pricing"
        className="mt-4 inline-flex rounded-lg bg-[#FF2BD6] px-3 py-1.5 text-xs font-semibold text-[#F1F1FB] hover:bg-[#E01BBE]"
      >
        {cta}
      </Link>
    </div>
  );
}
