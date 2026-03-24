# Triathlon Trainer

Eine anfängerfreundliche, datengetriebene Triathlon-/Multisport-Webapp mit automatischer 6-Monats-Trainingsplanung, Strava-Integration, Explainability-Layer sowie Forecasting- und Rennsimulationsmodul.

## Produktkern

Die App kombiniert fünf Funktionen in einem Produkt:

1. **Trainingsplaner** mit periodisierter 6-Monats-Planung.
2. **Trainingslogbuch** mit Plan-vs-Ist-Abgleich.
3. **Analyseplattform** mit Dashboards und Fortschrittsgrafiken.
4. **Explainability-System** („Warum wurde das so geplant?“).
5. **Forecast-Engine** inkl. Race-Pace- und Split-Simulationen.

## Zielgruppe

- **Primär:** Anfänger:innen im Triathlon (Volkstriathlon bis Olympisch).
- **Sekundär:** Ambitionierte Hobbyathlet:innen mit Multi-Race-Kalender.

## MVP Scope

### Must-have Funktionen

- Onboarding mit Leistungsstand, Verfügbarkeit, Einschränkungen und Wettkampfkalender.
- Automatische, rollierende **6-Monats-Planung**.
- Mehrfach-Rennen-Planung (A/B/C-Priorität, Mini-Taper pro Event).
- Strava OAuth + Aktivitätsimport + automatischer Planabgleich.
- Dashboard (Volumen, Zonenverteilung, Konsistenz, Plan-vs-Ist).
- Regelbasierte Plananpassung bei Ausfällen/Überlastung/Abweichungen.
- Drill-Library mit Hover/Tooltip-Erklärungen.
- Explainability-Texte pro Einheit, Planänderung und Prognose.
- Basis-Prognosen für Swim/Bike/Run + Gesamtzeitkorridor.

### Nicht im MVP (ab V2/V3)

- Vollständige Wetter-/Streckenmodellierung.
- Erweiterte Injury-Prevention-Modelle.
- KI-Dialogcoach als eigener Assistent.
- Tiefe Videoanalyse von Technikdrills.

## Feature-Architektur

### 1) Onboarding & Profil

**Eingaben:**

- Alter, Geschlecht, Erfahrungslevel.
- 5-km-Zeit (optional), FTP (optional), Schwimmniveau.
- Verfügbare Trainingstage/Woche und Zeitbudget pro Einheit.
- Verletzungen/Einschränkungen.
- Wettkämpfe: Datum, Distanz, Priorität (A/B/C), Ziel (Finish/PB/Test).

### 2) Trainingsplan-Generator (Core Engine)

- Erzeugt immer einen rollierenden **6-Monats-Korridor**.
- Periodisierung: **Base → Build → Peak → Taper**.
- Mehrfachrennen: Wellenperiodisierung mit Mini-Tapern.
- Laststeuerung:
  - 70 % locker / 20 % moderat / 10 % intensiv.
  - Max. +10 % Volumensteigerung pro Woche.
- Tagesoutput:
  - Disziplin, Dauer, Intensität (Z1–Z5), Inhalte, Ziel, Begründung.

### 3) Automatische Plananpassung

**Trigger:**

- Verpasste Einheiten.
- Zu hohe/zu niedrige Intensität.
- Neue Rennen.
- Überlastungsindikatoren.
- Subjektive Müdigkeit.

**Aktionen:**

- Verschieben/verkürzen/vereinfachen von Einheiten.
- Deload früher einplanen.
- Taper ändern.
- Fokusblock verlagern.
- Prognose sofort neu berechnen.

Alle Anpassungen werden als **Changelog** erklärt: *Was geändert wurde, warum, und mit welcher erwarteten Auswirkung.*

### 4) Forecast & Simulation (Kernmodul)

#### Forecast-Typen

1. **Current Fitness Projection** (Leistung, wenn heute Wettkampf wäre).
2. **Planned Training Projection** (Leistung bei Plan-Compliance).
3. **Scenario Projection** (optimistisch/realistisch/konservativ).
4. **What-if Simulation** (z. B. Ausfallwochen, zusätzlicher Radtag, weniger Laufeinheiten).

#### Disziplinspezifische Outputs

- **Run:** 5k/10k-Potenzial, Schwellenpace, Tri-Run-Pace nach Vorermüdung.
- **Bike:** modellierte FTP, Race Power je Distanz, IF-Empfehlung, Split-Prognose.
- **Swim:** CSS-nahe Pace, Freiwasser-Korrektur, Split je Distanz.
- **Gesamt:** Split-Zeiten inkl. T1/T2, Zielzeitkorridor, Unsicherheit.

#### Rennsimulation

Szenarien pro Rennen:

- konservativ
- realistisch
- aggressiv
- negative split-orientiert
- finish-orientiert

Outputs:

- empfohlene Pace/Watt/HF je Disziplin
- Splits und Gesamtzeit
- Warnhinweise (z. B. „Bike zu aggressiv → Laufabfall wahrscheinlich“)

### 5) Explainability Layer

Jede Entscheidung ist nachvollziehbar:

- Warum heute diese Einheit?
- Warum diese Intensität?
- Warum nicht härter/länger?
- Warum wurde der Plan geändert?
- Warum hat sich die Prognose verändert?

Anzeige in drei Ebenen:

1. **Kurz** (1 Satz)
2. **Mehr erfahren** (3–5 Sätze)
3. **Fundierte Begründung** (tiefer Trainingskontext)

### 6) Drill-Library (Tooltip System)

Jeder Drill enthält:

- Name, Disziplin, Kurzbeschreibung
- Ziel
- Häufige Fehler
- Körpersensationen („was man spüren soll“)
- Anfänger-Eignung

## Daten- und Systemarchitektur

### Frontend

- Next.js (React)
- Tailwind CSS
- Recharts für Visualisierungen

### Backend

- Node.js + TypeScript
- REST oder GraphQL
- Rule Engine + Explainability Layer

### Datenbank

- PostgreSQL

### Integrationen

- OAuth (inkl. Strava)
- Aktivitätsimport (Distanz, Pace, Watt, HF etc.)

## Datenmodell (MVP + Forecast-Erweiterung)

### Kernentitäten

- `users`
- `races`
- `workouts` (planned/actual)
- `gear_items`

### Forecast-/Explainability-Entitäten

- `performance_snapshots`
  - disziplinspezifische Leistungsschätzer + Confidence + Model-Version
- `race_predictions`
  - Szenario-Splits + Gesamtzeit + Erklärung
- `plan_adjustments`
  - alte/neue Einheit + Grund + Prognose-Delta
- `exercise_explanations`
  - Drill-Wissensdatenbank

## Regelwerk (versioniert)

Beispielregeln:

- Wenn 3 harte Tage in 5 Tagen: Belastung reduzieren.
- Wenn Rennen in 14 Tagen: keine neue Spitzenbelastung.
- Wenn GA1 regelmäßig zu hart: Pacing-Empfehlung senken.
- Wenn Rad steigt, Lauf stagniert: Laufökonomie priorisieren.

Jede Regel liefert:

- Entscheidung
- maschinenlesbaren Grund
- nutzerlesbare Erklärung

## Dashboard & Visualisierung

- Fitness/Fatigue/Form-Linien über Zeit
- Wochenvolumen (stacked pro Disziplin)
- Intensitätsverteilung (Donut + Trend)
- Plan-vs-Ist (Heatmap + Wochenvergleich)
- Race Prediction Graph (3 Szenariokurven + Unsicherheitsband)
- Projection-after-change (alte vs. neue Prognose)
- Race Readiness Gauge
- Consistency Heatmap

## Delivery Roadmap

### V1 (MVP)

- 6-Monats-Generator
- Mehrfachrennen-Planung
- Strava-Import
- Basale Forecasts
- Plananpassung auf Regelbasis
- Drill-Tooltips
- Dashboard-Basischarts

### V2

- Split-Simulation pro Rennen
- Szenariomodellierung mit Unsicherheit
- Gear-Warnungen
- Erweitertes Fatigue-/Load-Modell

### V3

- Wetter- und Streckenmodellierung
- Open-Water-Feinkorrekturen
- Coach-/Admin-Ansicht
- KI-Coach-Dialog

## Qualität & UX-Prinzipien

- Sehr einfache Sprache für Anfänger:innen.
- Kein Fachbegriff ohne direkte Erklärung.
- Jede Kennzahl mit Tooltip, jede Grafik mit Kontexttext.
- Farbklare Intensitätsdarstellung.
- Transparenz vor „Black Box“-Vorhersagen.

## Implementierungsziel für Codex

Das System soll so modular umgesetzt werden, dass Codex direkt implementieren kann:

- Full-Stack Webapp (Next.js + Node + PostgreSQL)
- Trainingsengine (6 Monate, Multi-Race)
- Strava OAuth + Import-Pipeline
- Forecast- und Simulationsmodule
- Explainability Layer
- Drill-Wissensdatenbank
- Dashboard mit Forecast-Visualisierung
- Gear Tracking + Wartungslogik

## Aktueller Implementierungsstand (Code)

Dieses Repository enthält jetzt einen ersten MVP-Code-Backbone für die Trainingslogik:

- `src/engine/planGenerator.js`: Generiert einen rollierenden 26-Wochen-Plan mit Periodisierung und Explainability-Texten.
- `src/engine/forecastEngine.js`: Liefert aktuelle Fitnessprojektion, geplante Projektion, Unsicherheitskorridor und Projektion-Delta.
- `src/engine/adjustmentEngine.js`: Regelbasierte Plananpassung inkl. Changelog, Impact-Summary und Prognose-Delta.
- `src/engine/adjustmentHistoryStore.js`: In-Memory-Historie für nachvollziehbare automatische Plananpassungen.
- `src/engine/raceSimulationEngine.js`: Rennsplit-Simulation, Multi-Szenario-Bundle und What-if-Impact.
- `src/engine/ruleEngine.js`: Versionierte Rule-Engine mit transparenten Coaching-Empfehlungen, Evidenzfeldern und Priorisierung nach A/B/C-Rennen.
- `src/engine/loadModelEngine.js`: V2-Load/Fatigue-Modell mit CTL/ATL/Form, Ramp-Rate und Risikoindikator.
- `src/engine/stravaImportEngine.js`: Strava-Import-Normalisierung und Plan-vs-Ist-Abgleich mit Compliance-Quote.
- `src/engine/dashboardAssembler.js`: Kombiniert Summary, Load, Rules und Anpassungs-Historie in einer Dashboard-Gesamtantwort.
- `src/engine/weatherCourseEngine.js`: V3-Wetter-/Streckenkorrektur für Rennsimulation (Hitze, Wind, Höhenmeter, Freiwasser, Regen).
- `test/*.test.js`: Node-Test-Suite für Plan, Forecast, Simulation, Rules und Anpassungslogik.

### Lokales Ausführen

```bash
npm test
```

## API-Backbone (neu)

Ein minimaler HTTP-Server ist vorhanden (`src/server.js`) mit JSON-Endpunkten und Basis-Validierung für Array-Payloads:

- `GET /health`
- `POST /api/plan/generate`
- `POST /api/plan/adjust`
- `POST /api/plan/adjust-with-impact`
- `GET /api/plan/adjustments`
- `POST /api/forecast/current`
- `POST /api/forecast/planned`
- `POST /api/forecast/scenario`
- `POST /api/forecast/uncertainty`
- `POST /api/forecast/delta`
- `POST /api/forecast/zones`
- `POST /api/simulate/race`
- `POST /api/simulate/race-scenarios`
- `POST /api/simulate/race-conditions`
- `POST /api/simulate/what-if`
- `POST /api/gear/analyze`
- `POST /api/dashboard/summary`
- `POST /api/dashboard/full`
- `POST /api/load/metrics`
- `POST /api/rules/evaluate`
- `POST /api/strava/import`

Server starten:

```bash
npm run start
```

## V1 Web App (fertig)

Die V1 ist als lauffähige Web-App in `public/` umgesetzt:

- `public/index.html`: Onboarding, Forecast-Panel, Forecast-Korridor (v2), Dashboard-Snapshot, Plananpassung-Impact (v2), Anpassungs-Historie, Rule-Hinweise, Load-&-Fatigue-Block (v2), Rennsimulation, 14-Tage-Plan, Drill-Tooltip-Liste, Gear-Tracking und Strava-Import-Block (v2).
- `public/app.js`: Verknüpft UI mit den API-Endpunkten und rendert Daten.
- `public/styles.css`: Einfache, anfängerfreundliche Darstellung.

Start lokal:

```bash
npm run start
# dann http://localhost:3000 öffnen
```
