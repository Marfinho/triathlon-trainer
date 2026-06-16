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
    <div className="rounded-2xl border border-[#F0A500]/40 bg-[#F0A500]/5 p-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#F0A500]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#b07700]">
          Ab Pro verfügbar
        </span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      <Link
        href="/#pricing"
        className="mt-4 inline-flex rounded-lg bg-[#F0A500] px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] hover:bg-[#d99500]"
      >
        {cta}
      </Link>
    </div>
  );
}
