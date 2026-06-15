# LocalHub

**LocalHub ist die Datendrehscheibe für dein Triathlon-/Ausdauertraining – nicht der Coach.**
Du bist der Coach, unterstützt durch ein externes LLM (ChatGPT/Claude). LocalHub
sammelt Daten, exportiert strukturierte Zusammenfassungen, importiert Pläne,
validiert sie hart und hält Intervals.icu synchron.

> Dieses Repository wurde von Grund auf neu aufgebaut. Die frühere Architektur
> mit autonomer Coach-Logik (`TrainingIntent`, `AdaptationEngine`,
> `StrategyAdjustmentEngine` …) wurde vollständig entfernt und wird **nicht**
> wieder aufgenommen.

## Grundidee

LocalHub übernimmt **Datenhaltung und Workflow**, das LLM übernimmt die
**sportwissenschaftliche Entscheidung**. Der Austausch läuft bewusst manuell per
Copy & Paste – es gibt keine direkte LLM-API-Anbindung.

**LocalHub:**

- Import & Sammlung von Trainingsdaten (manuell + Intervals.icu)
- Anzeige/Verwaltung geplanter Workouts
- Export modularer `coach_summary` (JSON, kopierbar)
- Import konkreter `localhub_plan` (JSON) aus dem LLM
- Harte Validierung dieser Pläne
- Schutz erledigter/Ist-Aktivitäten (werden **nie** überschrieben)
- Idempotenter Sync geplanter Workouts mit Intervals.icu (keine Duplikate)
- Plan-vs-Ist-Auswertung
- Dashboard für Training, Readiness, Schmerzstatus, Sync-Zustand

**Externes LLM:** Bewertung, Periodisierung, Trainingsentscheidung,
Plan­erstellung im `localhub_plan`-Format.

## Ziel-Workflow

1. LocalHub sammelt Daten (Intervals.icu / manuell).
2. LocalHub erzeugt eine modulare `coach_summary` (JSON, kopierbar).
3. Nutzer kopiert die Summary in einen LLM-Chat.
4. Das LLM erstellt einen `localhub_plan` (JSON).
5. Nutzer importiert den Plan in LocalHub.
6. LocalHub validiert den Plan hart.
7. LocalHub ersetzt **nur offene** geplante Workouts im Importzeitraum.
8. LocalHub schützt abgeschlossene/Ist-Aktivitäten vollständig.
9. LocalHub synchronisiert die offenen geplanten Workouts nach Intervals.icu.

## Tech-Stack

- **TypeScript** durchgehend
- **Next.js** (App Router) – Frontend + Backend (API Routes / Server Actions)
- **Tailwind CSS** (v4) für Styling
- **Prisma ORM** mit **SQLite** lokal (Wechsel auf PostgreSQL später einfach)
- **Vitest** für Tests
- **Intervals.icu REST API** als externe Integration
- **Kein** ChatGPT-API-Call – Austausch ist Copy & Paste über die UI

## Setup

```bash
# 1. Abhängigkeiten installieren (führt auch `prisma generate` aus)
npm install

# 2. Umgebungsvariablen anlegen
cp .env.example .env   # Werte anpassen (Intervals.icu Key etc.)

# 3. Datenbank/Schema vorbereiten (ab Schritt 2 mit Migrationen)
npm run db:push

# 4. Entwicklung starten
npm run dev            # http://localhost:3000  →  /dashboard

# Weitere Skripte
npm run build          # Produktionsbuild
npm run test           # Vitest
```

## Projektstruktur

```
src/
  app/
    dashboard/page.tsx        Dashboard (Einstieg)
    api/                      coach-summary | plan-import | intervals-sync
  components/dashboard/       UI-Komponenten
  domain/
    plan-import/              validateLocalhubPlan, importLocalhubPlan
    coach-summary/            buildCoachSummary
    training/                 Plan-/Ist-Hilfsfunktionen
  integrations/intervals/     client, syncPlannedWorkout, syncQueue, hashWorkout
  lib/db.ts                   Prisma-Client
prisma/schema.prisma          Datenmodell
docs/CHATGPT_LOCALHUB_PROMPT.md  System-Prompt für das externe LLM
tests/                        Vitest-Tests
```

## Datenbank: SQLite jetzt, PostgreSQL später

Für die lokale Entwicklung nutzt LocalHub SQLite (`DATABASE_URL="file:./dev.db"`).
Für einen Wechsel auf PostgreSQL:

1. In `prisma/schema.prisma` `provider = "postgresql"` setzen.
2. In `.env` eine Postgres-`DATABASE_URL` hinterlegen.
3. Migrationen neu erzeugen (`npm run db:migrate`).

Das Schema vermeidet bewusst SQLite-spezifische Konstrukte, damit dieser Wechsel
möglichst reibungslos bleibt.

## Wichtige Invarianten

- `ActualActivity` und `completed` Workouts sind **unantastbar** – kein Import
  und kein Sync verändert oder löscht sie.
- Planimport ersetzt ausschließlich **offene** Workouts (`planned`/`synced`) im
  Importzeitraum (Markierung als `replaced`).
- Intervals.icu ist **Spiegel** geplanter Workouts; Ist-Aktivitäten fließen nur
  **von** Intervals.icu **nach** LocalHub.
- Sync ist **idempotent**: wiederholtes Ausführen erzeugt keine Duplikate.

## Bewusste Entscheidungen (V1)

- **Tailwind v4** mit `@tailwindcss/postcss` (kein klassisches `tailwind.config.js`).
- **Next.js App Router** statt Pages Router.
- **SQLite** lokal, PostgreSQL-kompatibles Schema.
- Kein autonomer Coach, keine Intent-/Adaptation-/Strategy-Logik.
- RacePrep / Fueling sind bewusst **nicht** Teil von V1.

## Build-Status / Roadmap

Umsetzung erfolgt in kleinen Schritten:

1. ✅ Projekt-Grundgerüst (Next.js + TS + Tailwind + Prisma + Vitest)
2. ⏳ Prisma-Schema (vollständig) + erste Migration
3. ⏳ JSON-Typen/Schemas (`coach_summary`, `localhub_plan`)
4. ⏳ `validateLocalhubPlan` + Tests
5. ⏳ `importLocalhubPlan` + Tests
6. ⏳ `buildCoachSummary` + Presets + Tests
7. ⏳ Intervals.icu Client + Sync + `hashWorkout` + Tests
8. ⏳ Dashboard-UI
9. ⏳ `docs/CHATGPT_LOCALHUB_PROMPT.md`
10. ⏳ Finaler Durchgang
