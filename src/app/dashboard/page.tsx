const WORKFLOW_STEPS = [
  {
    title: "1 · Daten sammeln",
    body: "Trainingsdaten manuell oder aus Intervals.icu importieren.",
  },
  {
    title: "2 · CoachSummary exportieren",
    body: "Modulare coach_summary (JSON) erzeugen und kopieren.",
  },
  {
    title: "3 · LLM befragen",
    body: "Summary extern ins LLM (ChatGPT/Claude) einfügen.",
  },
  {
    title: "4 · Plan importieren",
    body: "localhub_plan (JSON) zurück in LocalHub importieren.",
  },
  {
    title: "5 · Validieren & ersetzen",
    body: "Harte Validierung; nur offene Workouts werden ersetzt.",
  },
  {
    title: "6 · Intervals.icu Sync",
    body: "Offene geplante Workouts idempotent synchronisieren.",
  },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-400">
          LocalHub
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          LocalHub ist die Datendrehscheibe für dein Training – nicht der Coach.
          Du bist der Coach, unterstützt durch ein externes LLM. LocalHub sammelt
          Daten, exportiert strukturierte Zusammenfassungen, importiert Pläne,
          validiert sie hart und synchronisiert mit Intervals.icu.
        </p>
      </header>

      <section
        aria-label="Workflow"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {WORKFLOW_STEPS.map((step) => (
          <article
            key={step.title}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
          >
            <h2 className="text-sm font-semibold text-sky-300">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {step.body}
            </p>
          </article>
        ))}
      </section>

      <p className="mt-10 text-xs text-slate-500">
        Grundgerüst (Schritt 1). Die Dashboard-Komponenten – CoachSummary-Export,
        Planimport, Plan-vs-Ist und Sync-Status – folgen in den weiteren
        Schritten.
      </p>
    </main>
  );
}
