import { Card } from "./Card";

/**
 * Datenexport. Reine Download-Links auf /api/export – kein Client-State nötig,
 * daher bewusst als Server-Komponente gehalten.
 */
export function DataExport() {
  return (
    <Card
      title="Daten & Backup"
      subtitle="Lokale Daten sichern oder weiterverarbeiten"
    >
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/export?format=json"
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          Vollständiges Backup (JSON)
        </a>
        <a
          href="/api/export?format=csv"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Aktivitäten (CSV)
        </a>
        <a
          href="/api/report"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Wochenbericht (Markdown)
        </a>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">
        Der Export läuft vollständig lokal. Es werden keine Daten an Dritte
        gesendet.
      </p>
    </Card>
  );
}
