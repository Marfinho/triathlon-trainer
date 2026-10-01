# Übungsbibliothek (Kraft & Mobility)

LocalHub zeichnet zu jeder Übung **Muskelbild**, **Ablauf in vier Bildern**,
**Animation** und (falls vorhanden) ein **Fehlerbild** – ohne Bilddateien. Eine
Übung ist eine reine Datendefinition; die Engine erzeugt daraus die Bilder.

Es gibt zwei Formate:

- **2.0 „3d“** (neu): Posen als **Gelenkwinkel** eines stilisierten 3D-Körpers,
  dazu Kontakte (Boden, Bank, Wand) und Muskelaktivierung. Die App setzt den
  Körper selbst auf, berechnet Zwischenbilder und zeigt ihn **drehbar in 3D**
  (three.js, Umschalter Körper/Muskeln). Standbilder, Listen und Geräte ohne
  WebGL bekommen dieselbe Szene als flache SVG-Projektion.
- **1.x „2D“**: Bildpunkte einer Seitenansicht (bisherige Engine). Bleibt als
  Fallback für alle Übungen ohne 3D-Fassung und ist golden-getestet.

Gibt es zu einer ID beide Fassungen, zeigt die App die 3D-Fassung.

LocalHub bleibt Datendrehscheibe, nicht Coach: Das externe LLM referenziert
Übungen im Plan (`exercise.id`), LocalHub prüft, speichert und zeigt sie an.

## Wo was liegt

| Pfad | Inhalt |
| --- | --- |
| `src/domain/exercises/schema.ts` | Zod-Schema: Übung, Pose, Gliedmaßen, Muskeln, Segment-`exercise` |
| `src/domain/exercises/library/exercise-library.json` | 20 eingebaute Übungen (beim Modulladen validiert) |
| `src/domain/exercises/engine/` | 2D-Figuren-Engine (reines TypeScript, 1:1-Port von `engine.js`) |
| `src/domain/exercises/library/exercise-library-3d.json` | 3D-Übungen (Format 2.0), beim Laden validiert und fachlich geprüft |
| `src/domain/exercises/body3d/` | 3D-Kern: Skelett & Gelenkbereiche, Muskelkatalog, Kinematik/Kontakte, Prüfung, Szene, SVG-Projektion, KI-Bauplan |
| `src/domain/exercises/any.ts` | Gemeinsame Sicht auf beide Formate (Rendern, Muskeln, Dauer, Schema) |
| `src/domain/exercises/singleExercise.ts` | Einzelne neue Übung prüfen und speichern („Neue Übung mit KI“) |
| `src/components/exercises/Exercise3dViewer.tsx` | 3D-Ansicht (lädt `three/body3dRenderer.ts` nach) |
| `scripts/dev/tune3d.ts` | Entwickler-Werkzeug: prüft eine 3D-Bibliothek und schreibt eine HTML-Vorschau |
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

### 3D-Format 2.0 (`format: "3d"`)

Kurzfassung (vollständiger Bauplan: `EXERCISE_3D_GUIDE` in
`src/domain/exercises/body3d/guide.ts`, Beispiel: Glute Bridge in
`exercise-library-3d.json`):

- Koordinaten in cm: x = vorn, y = oben, z = rechts, Boden y = 0. Alle Winkel 0
  = aufrecht stehend, Arme hängen.
- `keyframes[2–6]`: `joints` (Becken `pitch/roll/yaw`, Wirbelsäule, Hals,
  Hüfte `flex/abd/rot`, Knie, Sprunggelenk `dorsi`, Schulter, Ellbogen – jeweils
  mit Bewegungsumfang), `contacts` (`left_heel: "floor"`, `right_ball: "bench"` …),
  `activation` (Muskel → 0…1), `label`, `toNextSec`, `holdSec`.
- `muscles[1–8]`: Muskel aus dem Katalog (18 Muskeln, optional `_l`/`_r`) mit
  Rolle `work` | `stretch` | `stabilize`. Muskeln hängen als Spindeln zwischen
  Ursprung und Ansatz am Skelett und verkürzen/dehnen sich mit der Bewegung.
- `frames` (genau 4, `at` = Position im Ablauf), `fault` (Pose + `caption`),
  `view`, `props` (Box, Wand, Matte, Kettlebell, Band).

Fachliche Prüfung (`validateExercise3d`): Gelenkbereiche, Kontakte (≤ 3 cm Rest,
Hände/Füße ≤ 12 cm nachgeführt), nichts im Boden, sichtbare Bewegung,
Aktivierung nur für beschriebene Muskeln. Fehler melden Pfad und Grund, z. B.
„Knie links flex 170° liegt außerhalb 0…155°“ – so kann eine KI gezielt
korrigieren.

### Eigene Übungen

Zwei Wege, beide prüfen Schema **und** Posen und speichern pro Nutzer in
`CustomExercise` (`userId` + `exerciseId` eindeutig, höchstens 200 pro Nutzer):

1. **Im Plan** (`exerciseDefinitions`, nur 1.1): Top-Level-Array, max. 20
   Einträge und 200 KB. Formate 2.0 und 1.x werden akzeptiert.
2. **Einzeln** auf `/trainer/uebungen` → „Neue Übung mit KI“: Wunsch eingeben,
   Prompt (Bauplan + Beispiel + vorhandene IDs) kopieren, Antwort der KI
   einfügen, **Prüfen** (Fehler lassen sich für die KI kopieren), Vorschau
   ansehen und erst mit **Übung übernehmen** speichern
   (`POST /api/exercises/custom`, `mode: "validate" | "save"`).
Gespeichert wird pro Nutzer in `CustomExercise` (`userId` + `exerciseId`
eindeutig, höchstens 200 pro Nutzer). Beim Lesen wird jede Definition erneut mit
Zod geprüft; ungültige erscheinen als Platzhalter.

**Farben:** Die Figur nutzt eigene CSS-Variablen `--fig-*` (helle und dunkle
Palette, `src/app/globals.css`), keine Tailwind-Skalen. Der 3D-Viewer liest
dieselben Variablen.

**Sicherheit:** Definitionen enthalten nur Zahlen, Enums und kurze Texte
(keine Steuerzeichen). Kein Roh-SVG/HTML/URL. Die Engine escaped alle Texte
(`& < > " '`). `dangerouslySetInnerHTML` wird ausschließlich für Engine-Ausgabe
verwendet (`ExerciseFigure`, `Exercise3dViewer`); Texte der KI (Fehler, Titel in
der Vorschau) erscheinen als normaler React-Text.

### Coach-Export

Bei `exportPurpose` `training_plan` und `plan_review` enthält die
`coach_summary` ein `exerciseCatalog` (`id`, `title`, `category`, `muscles`,
`dose`, eigene Übungen mit `custom: true`) und **immer** den 3D-Bauplan
`exerciseDefinitionGuide` samt `exerciseDefinitionExample` – die KI kann also
jederzeit eigene Übungen mitliefern (abschaltbar nur per
`allowCustomExercises: false` in der API).

## Fehlercodes beim Import

| Code | Art | Bedeutung |
| --- | --- | --- |
| `EXERCISE_UNKNOWN` | Fehler | `exercise.id` weder in der Bibliothek, noch in `exerciseDefinitions`, noch als gespeicherte eigene Übung des Nutzers |
| `EXERCISE_ID_COLLISION` | Fehler | Eigene Definition nutzt die ID einer eingebauten Übung |
| `EXERCISE_ID_DUPLICATE` | Fehler | ID doppelt in `exerciseDefinitions` |
| `EXERCISE_DEFINITIONS_TOO_LARGE` | Fehler | `exerciseDefinitions` über 200 KB (UTF-8-Bytes) |
| `EXERCISE_DEFINITIONS_NEED_1_1` | Fehler | `exerciseDefinitions` mit `schemaVersion` ≠ `"1.1"` |
| `CUSTOM_EXERCISE_LIMIT` | Fehler | Mehr als 200 eigene Übungen pro Nutzer |
| `EXERCISE_POSE_INVALID` | Fehler | 3D-Übung: Gelenk außerhalb des Bereichs, Kontakt schwebt/steckt, Hände/Füße zu weit nachgeführt, Körperteil im Boden, Bilder zu ähnlich, Aktivierung für nicht beschriebenen Muskel |
| `SCHEMA_INVALID` | Fehler | Strukturfehler (z. B. ungültige Definition, Koordinate außerhalb des Bereichs) |
| `EXERCISE_DEFINITION_UNUSED` | Warnung | Definition wird im Plan nicht verwendet (wird trotzdem gespeichert) |
| `EXERCISE_DURATION_IMPLAUSIBLE` | Warnung | Geschätzte Übungsdauer weicht um > 50 % von `durationSec` ab |
| `EXERCISE_DEFINITION_UPDATED` | Warnung | Gespeicherte eigene Übung wird mit neuer Definition überschrieben |
| `EXERCISE_POSE_WARNING` | Warnung | 3D-Übung: Schwerpunkt außerhalb der Stützfläche oder Zwischenbild taucht in den Boden |

Fehler blockieren den Import vollständig (eine Transaktion, nichts wird
gespeichert). Warnungen blockieren nicht.

Dauerschätzung (`estimateExerciseDurationSec`): Satz = `reps × Wiederholungsdauer`
(2D: `toEnd + holdEnd + toStart + holdStart`; 3D: alle `toNextSec` + `holdSec`)
bzw. `holdSec`, bei `perSide` doppelt; gesamt =
Sätze × Satz + (Sätze − 1) × `restSec`.

## Neue eingebaute Übung ergänzen

**3D (bevorzugt):** Definition in `exercise-library-3d.json` ergänzen, dann
`npx tsx scripts/dev/tune3d.ts src/domain/exercises/library/exercise-library-3d.json /tmp/vorschau.html`
– gibt Fehler/Warnungen und Kontaktwerte aus und schreibt eine HTML-Vorschau.
Die Bibliothek wirft beim Laden bei jedem Fehler. Danach den Katalog-Fixture
(siehe Schritt 5 unten) anpassen.

**2D:**

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
