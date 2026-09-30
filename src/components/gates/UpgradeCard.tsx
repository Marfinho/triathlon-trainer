import Link from "next/link";

/** Pink getönte Karte mit Feature-Beschreibung + Upgrade-CTA (FEATURE-GATE). */
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
    <div className="rounded-3xl border border-pink-200 bg-gradient-to-br from-pink-50 to-violet-50 p-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-pink-700">
          ✦ Ab Pro verfügbar
        </span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      <Link href="/#pricing" className="btn-pop mt-4 inline-flex px-4 py-2 text-xs">
        {cta}
      </Link>
    </div>
  );
}
