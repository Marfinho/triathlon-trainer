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

## Docker

LocalHub lässt sich vollständig als Container betreiben (Next.js + Prisma +
SQLite in einem Image). Die Datenbank liegt in einem benannten Volume und bleibt
über Neustarts erhalten; Migrationen werden beim Start automatisch angewandt.

```bash
# Bauen und starten
docker compose up --build        # http://localhost:3000  →  /dashboard

# im Hintergrund
docker compose up -d --build

# Stoppen (Daten bleiben im Volume erhalten)
docker compose down
```

Alternativ ohne Compose:

```bash
docker build -t localhub .
docker run -p 3000:3000 -v localhub-data:/app/data \
  -e SEED_ON_START=true localhub
```

**Konfiguration** (in `docker-compose.yml` oder via `-e`):

- `DATABASE_URL` – Standard `file:/app/data/localhub.db` (persistentes Volume).
- `SEED_ON_START` – `true` legt beim ersten Start Demodaten an.
- `INTERVALS_ATHLETE_ID` / `INTERVALS_API_KEY` – optionale Intervals.icu-Anbindung.

Der Container startet über `docker-entrypoint.sh`, der `prisma migrate deploy`
ausführt und danach die App startet.

> **Radrolle im Container:** Die Bluetooth-Steuerung läuft im Browser (nicht im
> Container). Über `http://localhost:3000` ist der Kontext sicher genug für Web
> Bluetooth – einfach Chrome/Edge auf dem Host verwenden. Hinter einem Reverse
> Proxy wird HTTPS benötigt.

## Projektstruktur

```
src/
  app/
    dashboard/page.tsx        Dashboard (Einstieg)
    api/                      coach-summary | plan-import | intervals-sync
                              activities | races | gear | goals | body
                              checkin | journal | profile | export
  components/
    dashboard/                UI-Komponenten (Plan, Form, Races, Gear, Trainer …)
    charts/                   abhängigkeitsfreie SVG-Charts
  domain/
    plan-import/              validateLocalhubPlan, importLocalhubPlan
    coach-summary/            buildCoachSummary
    training/                 Plan-vs-Ist, trainingLoad (CTL/ATL/TSB), races, gear
  integrations/
    intervals/                client, syncPlannedWorkout, syncQueue, hashWorkout
    trainer/                  FTMS, Watt-Auflösung, Player, Recording, Kickr-Client
  lib/db.ts                   Prisma-Client
prisma/schema.prisma          Datenmodell
docs/CHATGPT_LOCALHUB_PROMPT.md  System-Prompt für das externe LLM
tests/                        Vitest-Tests
```

## Module im Dashboard

Das Dashboard ist in drei ruhige Tabs gegliedert (Form & Planung · Training &
Material · Austausch & Sync):

**Form & Planung**
- **Form & Belastung** – Performance-Management-Chart (CTL/ATL/TSB), ACWR &
  Aufbaurate, 7-/28-Tage-Load, Wochenvolumen je Disziplin.
- **Wochenziele** – Zielstunden je Disziplin vs. laufende Woche.
- **Wettkämpfe & Saison** – Countdown, Priorität (A/B/C), Periodisierungsphase,
  Saison-Timeline und Ergebniserfassung vergangener Rennen.
- **Aktueller Plan / Letzte Aktivitäten** – nächste Einheiten (heute/morgen) und
  Wochen-Summary.
- **Trainingskalender** – Mo–So-Gitter mit geplanten/Ist-Einheiten und
  Wochensummen.
- **Saison-Statistik & Bestwerte** – Gesamtvolumen, Ø/Woche, Streak, Bestwerte je
  Disziplin, Zeitverteilung.
- **Plan vs. Ist** – Gesamt- und Wochen-Compliance plus Detailabgleich.
- **Trainingstagebuch** – Notizen mit Stimmung und Stimmungsverlauf.

**Training & Material**
- **Radrolle (Kickr Core v2)** – ERG-Steuerung & Aufzeichnung (siehe unten).
- **Trainingszonen** – Power, HF, Lauf- und Schwimm-Pace aus Schwellenwerten.
- **Sportgeräte** – Schuhe, Räder und Komponenten (z.B. Kette) mit automatischem
  km-/Stunden-Verschleiß-Tracking und Wartungs-/Austausch-Hinweisen.

**Austausch & Sync**
- **ChatGPT-Austausch** – CoachSummary-Export & Planimport.
- **Intervals.icu-Sync** – Queue-Status und letzte Sync-Ereignisse.
- **Readiness & Schmerz** – Tages-Check-in mit Verlauf.
- **Körpermetriken** – Gewicht, Ruhepuls, BMI mit Verlauf.
- **Daten & Backup** – JSON-Backup und Aktivitäten-CSV-Export.

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

## Funktionsumfang (V1)

Der komplette Workflow ist umgesetzt:

1. ✅ Projekt-Grundgerüst (Next.js + TS + Tailwind + Prisma + Vitest)
2. ✅ Prisma-Schema (vollständig) + erste Migration + Seed
3. ✅ JSON-Typen/Schemas (`coach_summary`, `localhub_plan`, Segmente)
4. ✅ `validateLocalhubPlan` + Tests
5. ✅ `importLocalhubPlan` (transaktional) + Tests
6. ✅ `buildCoachSummary` + Presets + Kontext-Sammler + Tests
7. ✅ Intervals.icu Client + `syncPlannedWorkout` + `syncQueue` + `hashWorkout` + Tests
8. ✅ Dashboard-UI (Export, Import, Plan-vs-Ist, Sync-Status, Readiness/Pain) + API-Routes
9. ✅ `docs/CHATGPT_LOCALHUB_PROMPT.md`
10. ✅ Finaler Durchgang (README, Aufräumen)

### Tests & Build

```bash
npm run test    # Vitest – Validierung, Import, CoachSummary, Hash/Sync, Plan-vs-Ist
npm run build   # Next.js Produktionsbuild (inkl. Typecheck/Lint)
```

Tests, die die Datenbank brauchen (Import, Sync), legen pro Lauf eine frische
temporäre SQLite-Datei an (`tests/helpers/testDb.ts`) – die Entwicklungs-DB wird
nicht berührt.

## Radrolle steuern (Wahoo Kickr Core v2)

Das Dashboard kann einen Smarttrainer per **Web Bluetooth** und dem
**FTMS-Standard** (Fitness Machine Service) im **ERG-Modus** steuern: ein
geplantes Rad-Workout wird Segment für Segment abgespielt und die Ziel-Watt
direkt an die Rolle gesendet. Live-Werte (Leistung, Trittfrequenz, Herzfrequenz)
werden aus den Indoor-Bike-Data des Trainers gelesen.

**Voraussetzungen**

- Browser mit Web Bluetooth: **Chrome oder Edge** (Desktop). Firefox/Safari
  werden nicht unterstützt.
- Sicherer Kontext: `http://localhost` (Entwicklung) oder **HTTPS** in
  Produktion – sonst blockiert der Browser den Bluetooth-Zugriff.
- Trainer eingeschaltet und nicht parallel mit einer anderen App (Wahoo,
  Zwift …) verbunden.

**Bedienung** (Dashboard → „Radrolle (Kickr Core v2)")

1. **FTP** prüfen/setzen (Default aus dem Athleten-Profil, lokal gespeichert).
2. **Verbinden** → Gerät im Bluetooth-Dialog wählen.
3. **Rad-Workout** auswählen und **Start** – die Segmente werden zeitgesteuert
   abgespielt, Ziel-Watt automatisch gesetzt.
4. **Korrektur ±5 W**, **Pause**, **Schritt überspringen**, **Stop** sowie eine
   **freie Watt-Vorgabe** (manueller ERG bei pausiertem Workout) stehen bereit.

**Watt-Ableitung:** Segmente mit explizitem Power-Target (`targetType: "power"`)
steuern direkt in Watt. Andernfalls wird aus Zone/Intensität bzw. RPE ein
Prozentsatz der FTP berechnet (`src/integrations/trainer/watts.ts`). Die reine
Protokoll-/Ableitungslogik ist unit-getestet; der Bluetooth-Zugriff selbst
(`kickrClient.ts`) ist browserseitig und nicht testbar.

> Hinweis: Die Steuerung läuft vollständig **lokal im Browser** – es werden keine
> Trainer-Daten an einen Server gesendet. Das Aufzeichnen/Hochladen der Einheit
> ist bewusst noch nicht Teil dieses Schritts (siehe offene Punkte).

## Architektur-Schichten

- `src/domain/schemas/` – Zod-Schemas + Typen der aktiven JSON-Formate.
- `src/domain/plan-import/` – `validateLocalhubPlan` (rein) und
  `importLocalhubPlan` (transaktional).
- `src/domain/coach-summary/` – `buildCoachSummary` (rein), Presets,
  DB-Kontext-Sammler.
- `src/domain/training/` – Datumshilfen, `buildPlanVsActual`.
- `src/integrations/intervals/` – Client (injizierbar), Hash, Sync, Queue.
- `src/integrations/trainer/` – FTMS-Protokoll, Watt-Ableitung, Workout-Player
  (rein/getestet) und Web-Bluetooth-Client für die Radrolle (browserseitig).
- `src/app/api/` – dünne Routen, die Domain-/Integrationscode aufrufen.
- `src/components/dashboard/` – UI; serverseitig geladene Daten, Client-
  Komponenten nur für Interaktion (Export/Import/Sync).

Die Domain-Logik ist bewusst **rein und ohne direkten DB-Zugriff** gehalten
(Daten werden als Parameter übergeben), damit sie einfach testbar bleibt. Die
DB-Anbindung erfolgt in Importer, Sync und API-Routen.

## Offene Punkte / Bewusst nicht in V1

- **Hintergrund-Scheduler**: Der Ist-Aktivitäten-Import aus Intervals.icu läuft
  automatisch beim Laden des Dashboards (gedrosselt) und beim manuellen Sync;
  ein echter Cron/Worker (für reine Server-Betriebszeit ohne offenes Dashboard)
  wäre der nächste Schritt.
- **Readiness/Pain-Erfassung** über die UI (Anzeige ist vorhanden, Eingabe-Formulare
  fehlen noch).
- **Hintergrund-Verarbeitung der SyncQueue** (aktuell manuell per Button/POST);
  ein Cron/Worker wäre der nächste Schritt.
- **Aufzeichnung der Rollen-Einheit** (Leistung/Trittfrequenz mitschreiben und
  als Aktivität speichern/hochladen) – die ERG-Steuerung ist vorhanden, das
  Recording fehlt noch.
- **RacePrep / Fueling** – bewusst ausgeklammert (separates späteres Thema).
- **Auth/Mehrbenutzer** – Single-User-Setup für lokale Nutzung.
- Hinweis: Prisma warnt, dass der `prisma`-Block in `package.json` (Seed) künftig
  in eine `prisma.config.ts` wandern soll – unkritisch, bei Bedarf später migrieren.
