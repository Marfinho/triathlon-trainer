# Prompt: Home-Assistant-Integration und Card für Brick

> Kopiere alles ab der Linie in eine neue Claude-Code-Sitzung in einem **leeren Repository**
> (z. B. `brick-homeassistant`). Der Prompt ist eigenständig; er enthält den Vertrag der Brick-API.

---

Baue eine **Home-Assistant-Custom-Integration `brick`** (HACS-fähig) und eine zugehörige
**Lovelace-Karte `brick-training-card`** für Brick, meinen Triathlon-Trainer. Alles Neue gehört in dieses Repository.
Arbeite in kleinen, sauberen Commits und lege am Ende einen PR gegen `main` an. Führe erst einen kurzen Plan
(ca. 10 Zeilen) vor, dann setze um.

## 1. Die Brick-API (Vertrag, nicht ändern)

Basis-URL: die Brick-Adresse des Nutzers (z. B. `https://brick.example`, ohne abschließenden Slash). Alle
Zeitangaben und "heute" beziehen sich auf den Kalendertag in **Europe/Berlin**.

### Sprechtext und Plan: `GET /api/voice/v1/summary`
- Header `Authorization: Bearer lht_…` (Token mit Scope **voice**).
- Query: `day=today|tomorrow|week` (week = heute plus 6 Tage), `detail=short|normal`
  (`normal` fügt Form und Wettkampf-Countdown in den Text ein, nie Gesundheitsdaten).
- Antwort `200`, `Cache-Control: no-store`:
  ```json
  {
    "text": "Heute steht Radfahren für 1 Stunde 20 auf dem Plan. Du bist gut erholt.",
    "items": [
      { "sport": "bike", "title": "Grundlagen Z2", "durationMin": 80, "status": "planned", "date": "2026-10-07" }
    ]
  }
  ```
  `sport` ∈ `run|bike|swim|strength|brick|mobility|walk|cross_training|other|rest`,
  `status` ∈ `planned|done`. `text` hat höchstens ca. 400 Zeichen. Keine IDs.
- Fehler: `401 {"error":"invalid_token"}` (Token falsch, widerrufen, falscher Scope),
  `400 {"error":"invalid_params"}`, `429 {"error":"too_many_requests"}` mit `Retry-After` (Sekunden).
- Limits: **30 Abfragen pro Minute je Token**, 20 fehlgeschlagene Authentifizierungen je 15 Minuten und IP.

### Kalender: `GET /api/calendar/v1/training.ics`
- Token mit Scope **calendar** per `?token=lht_…` oder `Authorization: Bearer lht_…`.
- ICS (RFC 5545), ganztägige Ereignisse (`DTSTART;VALUE=DATE`), 14 Tage zurück bis 120 Tage voraus.
  `SUMMARY` z. B. `Radfahren 1:20 h - Grundlagen`, erledigte beginnen mit `Erledigt: `, Wettkämpfe mit
  `Wettkampf: `. `CATEGORIES` ist `Training` oder `Wettkampf`. Limit 60 Abfragen pro Minute je Token.
- Ein calendar-Token öffnet **nicht** den Summary-Endpunkt und umgekehrt.

Tokens erzeugt der Nutzer in Brick (Profil → Gekoppelte Geräte, Einmal-Anzeige). Die Integration kann sie nicht selbst erzeugen.

## 2. Integration `custom_components/brick`

Pflicht-Anforderungen:
- **Config Flow** (UI): Felder Brick-URL, **Sprachassistent-Token** (Pflicht), **Kalender-URL oder -Token**
  (optional). Validierung beim Anlegen durch einen echten `summary`-Abruf: `401` → Fehler `invalid_auth`,
  Netzwerkfehler → `cannot_connect`, URL ohne Schema → Formularfehler. Eindeutige ID aus der normalisierten URL.
  **Reauth-Flow** bei `401` im Betrieb, **Reconfigure-Flow** für die URL. Optionen: Abfrageintervall (Standard 15 Min,
  Minimum 5 Min, damit das 30-pro-Minute-Limit nie berührt wird).
- **DataUpdateCoordinator** mit `aiohttp` über `async_get_clientsession`, Timeout 15 s. Pro Zyklus **drei** Abrufe:
  `today`+`normal`, `tomorrow`+`short`, `week`+`short`. Bei `429` den `Retry-After` respektieren
  (`UpdateFailed`, kein Hämmern). Bei `401` `ConfigEntryAuthFailed`. Daten in `entry.runtime_data` (typisiert).
- **Entitäten** (alle mit `has_entity_name`, Gerät "Brick", deutsche und englische Übersetzungen in `translations/`):
  - `sensor.brick_training_heute`: Zustand = Anzahl **offener** Einheiten (Zahl); Attribute `text`, `items`, `done_count`,
    `date`. Der Sprechtext darf **nicht** der Zustand sein (255-Zeichen-Grenze), sondern liegt im Attribut.
  - `sensor.brick_training_morgen` (analog) und `sensor.brick_training_woche` (Zustand = Zahl geplanter Einheiten
    in 7 Tagen, Attribute `text`, `items`).
  - `binary_sensor.brick_training_offen`: an, wenn heute noch mindestens eine Einheit `planned` ist.
  - `calendar.brick_training` nur wenn eine Kalender-Quelle konfiguriert ist: `CalendarEntity`, die den ICS-Feed
    mit der Bibliothek `icalendar` parst (ganztägige Ereignisse, `async_get_events`, `event`), Abruf höchstens
    stündlich mit `If-None-Match`/ETag-Unterstützung falls vorhanden. Das Parsen läuft nicht im Event-Loop-Thread blockierend.
- **Services** (mit `services.yaml`, Selektoren, Übersetzungen):
  - `brick.announce`: Felder `day` (today/tomorrow/week), `detail`, Ziel `media_player` (Entity-Selektor),
    `tts_entity`, optional `volume` (0-1) und `restore_volume` (bool, Standard true). Ruft frische Daten ab,
    setzt die Lautstärke, ruft `tts.speak` (mit `media_player_entity_id`, deutscher Sprache) auf, wartet bis die Ausgabe
    beendet ist (mit Timeout) und stellt die alte Lautstärke wieder her. Fällt der Abruf aus, spricht sie
    "Das Training konnte gerade nicht abgerufen werden." Zusätzlich Variante für Alexa Media Player:
    optionaler Parameter `notify_service` (z. B. `notify.alexa_media_echo_kueche`), dann `data: {type: tts}`.
  - `brick.refresh`: sofortiges Aktualisieren, mit Mindestabstand von 30 s zur letzten Abfrage.
- **Statische Frontend-Auslieferung:** Die Integration registriert `dist/brick-training-card.js` über
  `hass.http.async_register_static_paths` und lädt sie mit `frontend.add_extra_js_url`, damit der Nutzer keine
  Ressource von Hand eintragen muss.
- **Datenschutz/Sicherheit:** Token nie loggen, nie in Attribute oder Diagnostics (dort `async_redact_data`),
  Warnhinweis bei `http://` außerhalb des LAN im Config Flow. Keine Telemetrie. Keine zusätzlichen Brick-Endpunkte.
- Qualität: vollständig typisiert, `async`, kein blockierendes I/O, `manifest.json` (`domain: brick`,
  `config_flow: true`, `iot_class: cloud_polling`, `requirements: ["icalendar"]`, Version), `hacs.json`,
  `README.md` (deutsch, mit Screenshots-Platzhaltern), `strings.json`/`translations/de.json`/`en.json`, Diagnostics.

## 3. Lovelace-Karte `brick-training-card`

Entwicklung in `frontend/` mit **TypeScript und Lit**, Build mit esbuild oder Rollup zu **einer** Datei
`custom_components/brick/dist/brick-training-card.js` (die Build-Ausgabe ist eingecheckt, damit HACS ohne Build funktioniert).

Verhalten:
- Konfiguration: `entity` (Pflicht, `sensor.brick_training_heute`), `week_entity` (optional), `title`,
  `show_done` (Standard true), `show_announce_button` (Standard true), `announce` (Objekt mit `media_player`, `tts_entity`).
- Zeigt oben das Datum und den Zustand ("2 Einheiten offen" / "Alles erledigt" / "Heute ist nichts geplant"), darunter die
  Einheiten aus dem Attribut `items`: Sport-Icon (`mdi:run`, `mdi:bike`, `mdi:swim`, `mdi:dumbbell`, `mdi:yoga`,
  `mdi:walk`, `mdi:weight-lifter` für brick/Koppel, `mdi:sleep` für rest), Titel, Dauer ("1 Std 20", "45 Min"), Status-Chip
  (offen/erledigt, erledigte abgeschwächt und durchgestrichen). Optional darunter ein 7-Tage-Streifen aus
  `week_entity` (Tage gruppiert nach `date`, heute hervorgehoben, Punkte je Sportart).
- Knopf "Ansagen" ruft `brick.announce` mit der konfigurierten Box auf.
- Zustände `unavailable`/`unknown` mit klarer Meldung statt leerer Karte.
- **Visueller Editor** (`getConfigElement`, Entity-Picker), `getStubConfig`, `getCardSize`, Registrierung in
  `window.customCards`.
- Nur HA-CSS-Variablen (`--primary-text-color`, `--ha-card-background` usw.), damit helle und dunkle Themes gehen.
  Barrierefrei (Rollen, Fokus, Kontrast), deutsch und englisch nach `hass.language`.
- Keine externen Requests, keine Tracker, keine CDN-Importe.

## 4. Tests und Abnahme

- Python: `pytest-homeassistant-custom-component`. Abgedeckt: Config Flow (Erfolg, `invalid_auth`, `cannot_connect`),
  Reauth, Coordinator (Erfolg, `401`, `429` mit `Retry-After`), Sensorzustand/-attribute aus Beispiel-JSON,
  Kalender-Parsing mit einem Beispiel-ICS (ganztägig, Umlaute, gefaltete Zeilen, `\,` und `\;`), `announce`
  (Lautstärke setzen/zurücksetzen, Fehlerfall), Redaction in Diagnostics. HTTP wird gemockt, keine echten Aufrufe.
- Frontend: Vitest (oder web-test-runner) für Rendering je Zustand (leer, offen, erledigt, unavailable) und Editor.
- CI (GitHub Actions): `ruff`, `mypy`, `pytest`, Frontend-Typecheck, Test und Build; Build-Ausgabe muss mit dem eingecheckten
  Stand übereinstimmen. `hassfest` und HACS-Validation als Jobs.
- Abnahme: Alles grün; das README erklärt Installation per HACS, Token erzeugen (Verweis auf Brick-Profil), Einrichtung, die Karte
  mit YAML-Beispiel, ein Automationsbeispiel (Morgenansage) und die Fehlersuche.

## 5. Nicht tun
- Keine Änderungen an Brick und keine neuen Brick-Endpunkte annehmen. Nur die oben beschriebene API verwenden.
- Keine KI-/LLM-Aufrufe, keine Cloud-Dienste außer Brick und dem vom Nutzer gewählten TTS.
- Keine Gesundheitsdaten abfragen oder anzeigen. Der Wettkampf-Countdown kommt nur als Teil von `text`.
- Keinen Alexa-Skill bauen. Alexa nur über `notify_service` (Alexa Media Player, inoffiziell; im README das Ausfallrisiko nennen).
- Keine Token in Logs, Attributen, Screenshots oder Testdaten.
