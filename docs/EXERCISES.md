# Übungsbibliothek (Kraft & Mobility)

LocalHub zeichnet zu jeder Übung **Muskelbild**, **Ablauf in vier Bildern**,
**Animation** und (falls vorhanden) ein **Fehlerbild** – ohne Bilddateien. Eine
Übung ist eine reine Datendefinition; die Figuren-Engine erzeugt daraus SVG.

LocalHub bleibt Datendrehscheibe, nicht Coach: Das externe LLM referenziert
Übungen im Plan (`exercise.id`), LocalHub prüft, speichert und zeigt sie an.

## Wo was liegt

| Pfad | Inhalt |
| --- | --- |
| `src/domain/exercises/schema.ts` | Zod-Schema: Übung, Pose, Gliedmaßen, Muskeln, Segment-`exercise` |
| `src/domain/exercises/library/exercise-library.json` | 20 eingebaute Übungen (beim Modulladen validiert) |
| `src/domain/exercises/engine/` | Figuren-Engine (reines TypeScript, 1:1-Port von `engine.js`) |
| `src/domain/exercises/resolve.ts` | Auflösung: Bibliothek → eigene Übungen des Nutzers |
| `src/domain/plan-import/validateExercises.ts` | Fachliche Prüfung der Übungen eines Plans |
| `src/components/exercises/` | UI: Figur, Muskelbild, Ablauf, Animation, Detail, Kraft-Player |
| `tests/fixtures/exercises/golden/` | Erwartete Engine-Ausgabe (byte-genauer Golden-Test) |

Seiten: `/trainer?tab=kraft` (nächste Einheiten), `/trainer/uebungen` (Bibliothek),
`/trainer/uebungen/<id>` (Detail), `/trainer/kraft/<workoutId>` (geführte Einheit).

## Datenformat

### Segment mit Übung (`localhub_plan`, ab 1.1; auch in 1.0 erlaubt)

```json
"exercise": {
  "id": "clamshell",
  "sets": 2,
  "reps": 15,
  "holdSec": null,
  "restSec": 30,
  "perSide": true,
  "loadKg": null,
  "note": null
}
```

`reps` **oder** `holdSec` ist Pflicht. `durationSec` des Segments ist die
Gesamtzeit inklusive Pausen; die Segmentsumme muss wie bisher zu
`plannedDurationMin` passen.

### Eigene Übungen (`exerciseDefinitions`, nur 1.1)

Top-Level-Array im Plan, max. 20 Einträge und 200 KB. Aufbau siehe
`EXERCISE_DEFINITION_GUIDE` in `src/domain/exercises/coachGuide.ts` und das
Beispiel `src/domain/exercises/library/example-custom-exercise.json` (Bird Dog).
Gespeichert wird pro Nutzer in `CustomExercise` (`userId` + `exerciseId`
eindeutig, höchstens 200 pro Nutzer). Beim Lesen wird jede Definition erneut mit
Zod geprüft; ungültige erscheinen als Platzhalter.

**Farben:** Die Figur nutzt eigene CSS-Variablen `--fig-*` (dunkle Palette
passend zum Neon-Theme, `src/app/globals.css`), keine Tailwind-Skalen.

**Sicherheit:** Definitionen enthalten nur Zahlen, Enums und kurze Texte
(keine Steuerzeichen). Kein Roh-SVG/HTML/URL. Die Engine escaped alle Texte
(`& < > " '`). `dangerouslySetInnerHTML` wird ausschließlich für Engine-Ausgabe
verwendet (`ExerciseFigure`).

### Coach-Export

Bei `exportPurpose` `training_plan` und `plan_review` enthält die
`coach_summary` ein `exerciseCatalog` (`id`, `title`, `category`, `muscles`,
`dose`, eigene Übungen mit `custom: true`). Mit „Eigene Übungen erlauben“
(`allowCustomExercises: true`) kommen `exerciseDefinitionGuide` und
`exerciseDefinitionExample` hinzu.

## Fehlercodes beim Import

| Code | Art | Bedeutung |
| --- | --- | --- |
| `EXERCISE_UNKNOWN` | Fehler | `exercise.id` weder in der Bibliothek, noch in `exerciseDefinitions`, noch als gespeicherte eigene Übung des Nutzers |
| `EXERCISE_ID_COLLISION` | Fehler | Eigene Definition nutzt die ID einer eingebauten Übung |
| `EXERCISE_ID_DUPLICATE` | Fehler | ID doppelt in `exerciseDefinitions` |
| `EXERCISE_DEFINITIONS_TOO_LARGE` | Fehler | `exerciseDefinitions` über 200 KB (UTF-8-Bytes) |
| `EXERCISE_DEFINITIONS_NEED_1_1` | Fehler | `exerciseDefinitions` mit `schemaVersion` ≠ `"1.1"` |
| `CUSTOM_EXERCISE_LIMIT` | Fehler | Mehr als 200 eigene Übungen pro Nutzer |
| `SCHEMA_INVALID` | Fehler | Strukturfehler (z. B. ungültige Definition, Koordinate außerhalb des Bereichs) |
| `EXERCISE_DEFINITION_UNUSED` | Warnung | Definition wird im Plan nicht verwendet (wird trotzdem gespeichert) |
| `EXERCISE_DURATION_IMPLAUSIBLE` | Warnung | Geschätzte Übungsdauer weicht um > 50 % von `durationSec` ab |
| `EXERCISE_DEFINITION_UPDATED` | Warnung | Gespeicherte eigene Übung wird mit neuer Definition überschrieben |

Fehler blockieren den Import vollständig (eine Transaktion, nichts wird
gespeichert). Warnungen blockieren nicht.

Dauerschätzung (`estimateExerciseDurationSec`): Satz = `reps × (toEnd + holdEnd +
toStart + holdStart)` bzw. `holdSec`, bei `perSide` doppelt; gesamt =
Sätze × Satz + (Sätze − 1) × `restSec`.

## Neue eingebaute Übung ergänzen

1. Definition in `src/domain/exercises/library/exercise-library.json` ergänzen
   (Schema siehe oben; ID in kebab-case, eindeutig).
2. `npm test -- tests/exercises/schema.test.ts` – die Bibliothek wird beim Laden
   validiert; Fehler nennen ID und Pfad.
3. Golden-Datei erzeugen: `npx tsx scripts/generate-exercise-golden.ts`
   (schreibt nur **fehlende** Dateien).
4. Detailseite `/trainer/uebungen/<id>` im Browser prüfen.
5. `npm test` – Golden- und Eigenschaftstests müssen grün sein. Der Test zur
   Coach-Summary vergleicht den Katalog mit
   `tests/fixtures/exercises/example-exercise-catalog.json` – dort den neuen
   Eintrag ergänzen.

**Golden-Dateien nie still ändern.** Ändert sich die Optik absichtlich (Engine),
Golden-Dateien mit `--force <id …>` neu erzeugen und in einem **eigenen Commit
mit Begründung** einchecken. Weicht ein Golden-Test ohne Absicht ab, ist die
Engine falsch, nicht die Golden-Datei.
