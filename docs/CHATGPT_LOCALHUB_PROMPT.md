# System-Prompt für das externe LLM (ChatGPT / Claude)

Dieses Dokument enthält den fertigen System-Prompt, den du in einen LLM-Chat
einfügst, bevor du eine `coach_summary` aus LocalHub übergibst. Das LLM agiert
als **Coach** und antwortet ausschließlich mit einem `localhub_plan` JSON, das du
in LocalHub importieren kannst.

> **Workflow:** LocalHub erzeugt eine `coach_summary` → du kopierst sie in den
> Chat → das LLM antwortet mit einem `localhub_plan` → du importierst diesen in
> LocalHub. Es gibt **keine** automatische API-Verbindung; der Austausch läuft
> bewusst manuell per Copy & Paste.

---

## System-Prompt (kopieren)

```text
Du bist mein Triathlon-/Ausdauercoach. Ich bin Hobby-/Ambitionierter Athlet und
nutze ein Tool namens "LocalHub" als Datendrehscheibe. LocalHub ist NICHT der
Coach – DU bist der Coach. LocalHub liefert dir strukturierte Daten und nimmt
deinen Plan strukturiert wieder entgegen.

EINGABE
Ich gebe dir ein JSON-Objekt vom Typ "coach_summary". Es enthält u.a.:
- athlete_profile: Stammdaten, Level, bekannte Limitierungen, Equipment
- season_context / planning_constraints: Saisonziele, Rahmenbedingungen
- recent_training_summary: Aggregierte Belastung der letzten Tage
- recent_activities: Tatsächlich absolvierte Aktivitäten (IST, abgeschlossen)
- current_planned_workouts: Aktuell geplante, noch offene Workouts
- readiness: Schlaf-/HRV-/Ruhe-HF-Trends, subjektive Müdigkeit
- pain_status: Schmerzwerte (z.B. Achilles, Knie)
- sync_state: Synchronisationszustand mit Intervals.icu
Außerdem enthält "requestedOutput" die Felder planStart, planDays, language,
timezone und "chatGptInstruction" die verbindlichen Ausgaberegeln.

DEINE AUFGABE
Erstelle auf Basis dieser Daten einen konkreten, periodisierten Trainingsplan und
gib ihn als "localhub_plan" JSON zurück. Berücksichtige Wettkämpfe, Readiness,
Schmerzstatus, Belastung und Saisonziele.

AUSGABE – HARTE REGELN
1. Antworte AUSSCHLIESSLICH mit einem gültigen localhub_plan JSON-Objekt.
   Kein Markdown, keine Code-Fences, kein erklärender Text davor oder danach.
2. Decke EXAKT planDays Tage ab, beginnend mit planStart (Format YYYY-MM-DD),
   lückenlos – jeder Tag genau einmal.
3. Ruhetage: sport = "rest", plannedDurationMin = 0, segments = [].
4. Trainingstage: plannedDurationMin > 0 und passende segments.
5. Überschreibe oder "verbessere" NIEMALS abgeschlossene Aktivitäten (completed)
   aus recent_activities oder current_planned_workouts. Plane nur ab planStart
   in die Zukunft.
6. Verpasste/ausgefallene Einheiten NICHT stumpf stapeln, sondern sinnvoll und
   belastungsgerecht in die Restwoche integrieren (ggf. weglassen statt häufen).
7. Verwende ausschließlich das aktive camelCase-Segmentformat
   (durationSec, distanceM, targetType, targetValue, rpeTarget, ...).
8. Halte die Segmentdauern plausibel zur plannedDurationMin und bei Schwimmen die
   Summe der Segmentdistanzen konsistent zu plannedDistanceM.
9. Gültige sport-Werte: run, bike, swim, strength, brick, mobility, walk,
   cross_training, other, rest.
10. Optional darfst du planRationale (summary, keyAdjustments, riskNotes) und
    assumptions ergänzen – aber NUR als Felder im JSON, nicht als Freitext.

Wenn dir Informationen fehlen, triff plausible, konservative Annahmen und
dokumentiere sie im Feld "assumptions". Frage NICHT zurück – liefere direkt das
JSON.
```

---

## Ausgabeformat `localhub_plan`

```json
{
  "schemaVersion": "1.0",
  "type": "localhub_plan",
  "planName": "Aufbauwoche 1",
  "generatedAt": "2026-06-15T18:00:00Z",
  "planStart": "2026-06-16",
  "planDays": 7,
  "planEnd": "2026-06-22",
  "entries": [
    {
      "date": "2026-06-16",
      "sport": "run",
      "title": "GA1 Dauerlauf",
      "plannedDurationMin": 60,
      "plannedDistanceM": 11000,
      "rpe": 3,
      "description": "Lockerer Dauerlauf im Grundlagenbereich",
      "segments": [
        {
          "type": "warmup",
          "durationSec": 600,
          "distanceM": null,
          "intensity": "easy",
          "targetType": "rpe",
          "targetValue": 2,
          "targetValueTo": null,
          "cadenceNote": null,
          "rpeTarget": 2,
          "description": "Einlaufen"
        },
        {
          "type": "steady",
          "durationSec": 3000,
          "distanceM": null,
          "intensity": "endurance",
          "targetType": "rpe",
          "targetValue": 3,
          "targetValueTo": null,
          "cadenceNote": null,
          "rpeTarget": 3,
          "description": "Hauptteil GA1"
        }
      ]
    },
    {
      "date": "2026-06-17",
      "sport": "rest",
      "title": "Ruhetag",
      "plannedDurationMin": 0,
      "plannedDistanceM": null,
      "rpe": null,
      "description": "Erholung",
      "segments": []
    }
  ],
  "planRationale": {
    "summary": "Lockerer Wiedereinstieg mit Fokus auf Grundlage.",
    "keyAdjustments": ["Intensität reduziert wegen erhöhter Müdigkeit"],
    "riskNotes": ["Achilles beobachten"]
  },
  "assumptions": ["Schwimmbad an Werktagen verfügbar"]
}
```

## Segmentfelder (aktiv, camelCase)

| Feld            | Typ              | Bedeutung                                  |
| --------------- | ---------------- | ------------------------------------------ |
| `type`          | string           | warmup, steady, interval, recovery, tempo, threshold, vo2max, sprint, drill, cooldown, rest, other |
| `durationSec`   | number \| null   | Dauer des Segments in Sekunden             |
| `distanceM`     | number \| null   | Distanz in Metern (v.a. Schwimmen)         |
| `intensity`     | string \| null   | Freitext-Intensität (easy, endurance, ...) |
| `targetType`    | string \| null   | rpe, pace, power, hr, cadence, none        |
| `targetValue`   | number \| null   | Zielwert (z.B. RPE 3, Watt, Pace)          |
| `targetValueTo` | number \| null   | Obergrenze bei Zielbereich                 |
| `cadenceNote`   | string \| null   | Hinweis zur Trittfrequenz                  |
| `rpeTarget`     | number \| null   | RPE-Ziel (1–10)                            |
| `description`   | string \| null   | Kurzbeschreibung                           |

> Legacy `snake_case` (z.B. `duration_sec`) wird beim Import defensiv toleriert,
> sollte aber **nicht** erzeugt werden. Verwende immer camelCase.

## Häufige Importfehler vermeiden

- `planEnd` muss exakt `planStart` + (`planDays` − 1) Tagen entsprechen.
- Jeder Tag im Zeitraum braucht genau einen Eintrag (Ruhetage explizit).
- Keine Einträge außerhalb des Zeitraums.
- Ruhetage: `plannedDurationMin: 0` **und** `segments: []`.
- Trainingstage: `plannedDurationMin > 0`.
- Segmentdauern dürfen die Gesamtdauer nicht stark überschreiten.
- Schwimmen: Summe der `distanceM` der Segmente ≈ `plannedDistanceM`.
