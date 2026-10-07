# Sprachassistent-Ansage (Home Assistant → Sonos / Alexa)

Brick liefert einen fertigen **deutschen Sprechtext** zu deinem Training. Home Assistant (HA) ruft
ihn ab und lässt ihn auf einer Sonos-Box oder einem Echo vorlesen – ausgelöst per Sprachbefehl
("Alexa, was muss ich heute trainieren?"), Taster oder Automation.

```
Alexa-Routine ──▶ HA-Skript ──▶ GET /api/voice/v1/summary ──▶ { text }
 (Sprachbefehl)   training_ansage   (Bearer lht_…, Scope voice)     │
                        └────────▶ tts.speak → Sonos  /  notify.alexa_media → Echo ◀──┘
```

- **Kein KI-Aufruf:** Der Text wird deterministisch aus Plan und Aktivitäten zusammengesetzt
  (`src/lib/voice/summary.ts`). Gleiche Daten → gleicher Text.
- **Keine Gesundheitsdetails:** Weder Schmerz-, Schlaf- noch HRV-Daten kommen im Text vor. Mit
  `detail=normal` kommen nur eine grobe Formaussage ("Du bist gut erholt") und der Wettkampf-Countdown dazu.
- **Eigener Token-Scope:** Ein `voice`-Token darf *nur* diesen Endpunkt lesen – nicht die TV-API
  (`/api/tv/*`, `/api/live`) und nichts anderes. Umgekehrt darf ein TV-Token den Endpunkt nicht aufrufen.

## 1. Token erzeugen

1. Brick → **Profil → Gekoppelte Geräte → Sprachassistent-Token erzeugen** (Name z. B. "Home Assistant").
2. Der Token (`lht_…`) wird **genau einmal** angezeigt. Sofort kopieren und in HA ablegen
   (siehe unten). Später ist er nicht mehr einsehbar; bei Verlust entkoppeln und neu erzeugen.
3. Widerrufen: dieselbe Karte → **Entkoppeln**. Der Token ist unbefristet gültig, bis er widerrufen wird.

Technisch: `POST /api/device/tokens` mit `{ "name": "Home Assistant", "scope": "voice" }` (nur mit
Browser-Session). Voice-Token gibt es nicht über den Device-Code-Flow der TV-App.

## 2. Endpunkt

```
GET /api/voice/v1/summary?day=today|tomorrow|week&detail=short|normal
Authorization: Bearer lht_…
```

| Parameter | Werte                    | Standard | Bedeutung                                                                      |
|-----------|--------------------------|----------|--------------------------------------------------------------------------------|
| `day`     | `today`, `tomorrow`, `week` | `today`  | `week` = heute und die folgenden 6 Tage, je Tag eine kurze Aussage            |
| `detail`  | `short`, `normal`        | `short`  | `short`: nur Training. `normal`: zusätzlich Form und Wettkampf-Countdown       |

Antwort (`200`, `Cache-Control: no-store`):

```json
{
  "text": "Heute steht Radfahren für 1 Stunde 20 auf dem Plan. Du bist gut erholt. Bis zu deinem Wettkampf Kraichgau sind es noch ungefähr 6 Wochen.",
  "items": [
    { "sport": "bike", "title": "Grundlagen Z2", "durationMin": 80, "status": "planned", "date": "2026-10-07" }
  ]
}
```

- `status`: `planned` oder `done` (erledigt, per Aktivität oder Planstatus).
- Die Antwort enthält keine IDs, Token oder Nutzerdaten außer Training; Titel sind von Sonderzeichen bereinigt und gekürzt.
- Der Text ist höchstens ca. 400 Zeichen lang; bei vielen Einheiten steht "und N weitere".
- **Datum/Zeitzone:** "Heute" ist der Kalendertag in `Europe/Berlin` (kein UTC-Versatz zwischen 0 und 2 Uhr).
- Fälle: nichts geplant ("Heute ist nichts geplant."), Ruhetag, eine oder mehrere Einheiten, schon
  erledigt ("Das Radtraining hast du schon gemacht."), Woche, morgen.

Fehler: `401 invalid_token` (Token falsch, widerrufen oder falscher Scope), `400 invalid_params`,
`429 too_many_requests` (siehe Limits).

**Limits:** 30 Abfragen pro Minute je Token; 20 fehlgeschlagene Authentifizierungen je 15 Minuten
und IP. Für eine Ansage per Sprachbefehl ist das weit mehr als genug.

Test von Hand:

```bash
curl -s -H "Authorization: Bearer lht_DEIN_TOKEN" \
  "https://brick.example/api/voice/v1/summary?day=today&detail=normal"
```

## 3. Home Assistant einrichten

Voraussetzung: HA 2024.x oder neuer (`action:` statt `service:`; `rest_command` mit
`response_variable`). Basis-URL `https://brick.example` durch deine Brick-URL ersetzen.

### 3.1 Token und Abruf

`secrets.yaml` (der Token steht nur hier):

```yaml
brick_voice_authorization: "Bearer lht_DEIN_TOKEN"
```

`configuration.yaml`:

```yaml
rest_command:
  brick_training_summary:
    url: "https://brick.example/api/voice/v1/summary?day={{ day }}&detail={{ detail }}"
    method: GET
    headers:
      Authorization: !secret brick_voice_authorization
    timeout: 15
```

Optional als Sensor fürs Dashboard. Der Sprechtext kann länger als 255 Zeichen sein – der
Sensor-*Zustand* ist aber auf 255 Zeichen begrenzt, deshalb den Text als **Attribut** ablegen:

```yaml
sensor:
  - platform: rest
    name: Brick Training heute
    resource: "https://brick.example/api/voice/v1/summary?day=today&detail=short"
    headers:
      Authorization: !secret brick_voice_authorization
    scan_interval: 1800
    value_template: "{{ value_json['items'] | length }}"
    json_attributes:
      - text
```

Der Text steht dann in `state_attr('sensor.brick_training_heute', 'text')`. Für die Ansage ist
`rest_command` besser: Es holt immer frische Daten.

### 3.2 Weg a) Sonos mit `tts.speak` (HA Cloud oder Piper)

`scripts.yaml`:

```yaml
training_ansage:
  alias: Training ansagen (Sonos)
  fields:
    day:
      description: today, tomorrow oder week
      default: today
    detail:
      description: short oder normal
      default: normal
  mode: single
  sequence:
    - action: rest_command.brick_training_summary
      data:
        day: "{{ day | default('today') }}"
        detail: "{{ detail | default('normal') }}"
      response_variable: brick
    - variables:
        speech: >-
          {{ brick.content.text
             if brick.status == 200 and brick.content.text is defined
             else 'Das Training konnte gerade nicht abgerufen werden.' }}
        speaker: media_player.sonos_wohnzimmer
        old_volume: "{{ state_attr('media_player.sonos_wohnzimmer', 'volume_level') }}"
    - action: media_player.volume_set
      target:
        entity_id: "{{ speaker }}"
      data:
        volume_level: 0.35          # Ansage-Lautstärke
    - action: tts.speak
      target:
        entity_id: tts.home_assistant_cloud   # oder z. B. tts.piper
      data:
        media_player_entity_id: "{{ speaker }}"
        message: "{{ speech }}"
        language: de-DE                        # bei Piper weglassen (Stimme per Piper-Einstellung)
    # Warten, bis die Ansage angelaufen und wieder beendet ist, dann Lautstärke zurück.
    - wait_template: "{{ is_state(speaker, 'playing') }}"
      timeout: "00:00:08"
      continue_on_timeout: true
    - wait_template: "{{ not is_state(speaker, 'playing') }}"
      timeout: "00:01:30"
      continue_on_timeout: true
    - if: "{{ old_volume is number }}"
      then:
        - action: media_player.volume_set
          target:
            entity_id: "{{ speaker }}"
          data:
            volume_level: "{{ old_volume }}"
```

Hinweise:

- Entity-Namen (`media_player.sonos_wohnzimmer`, `tts.home_assistant_cloud`) an deine Installation anpassen.
- Sonos holt die Sprachdatei von HA. HA braucht dafür eine von Sonos erreichbare **interne URL**
  (Einstellungen → System → Netzwerk). Sonst bleibt die Box stumm.
- Eine laufende Musikwiedergabe wird durch die Ansage ersetzt und nicht automatisch fortgesetzt.
  Wer das braucht, sichert/stellt den Zustand mit einer eigenen Szene bzw. `media_player`-Automation wieder her.
- Lautstärke wird vorher gemerkt und nachher zurückgesetzt. Ist die Box aus/gruppiert, ist
  `volume_level` ggf. leer – dann wird nichts zurückgesetzt (`old_volume is number`).

### 3.3 Weg b) Alexa Media Player (HACS, inoffiziell)

> **Ausfallrisiko:** "Alexa Media Player" ist eine inoffizielle HACS-Integration. Sie meldet sich
> mit deinem Amazon-Konto über die Web-Schnittstelle an. Amazon-Änderungen, Captcha oder
> 2-Faktor-Abfragen können sie jederzeit unterbrechen (dann hilft meist ein Neu-Login in der
> Integration). Sie ist kein offizielles Amazon-Produkt; verlass dich für Wichtiges nicht allein darauf.

Voraussetzung: Integration über HACS installiert und mit dem Amazon-Konto verbunden. Danach gibt
es pro Echo einen Notify-Dienst `notify.alexa_media_<echo>` (z. B. `notify.alexa_media_echo_kueche`).

```yaml
training_ansage_alexa:
  alias: Training ansagen (Echo)
  fields:
    day:
      default: today
    detail:
      default: normal
  mode: single
  sequence:
    - action: rest_command.brick_training_summary
      data:
        day: "{{ day | default('today') }}"
        detail: "{{ detail | default('normal') }}"
      response_variable: brick
    - action: notify.alexa_media_echo_kueche
      data:
        message: >-
          {{ brick.content.text
             if brick.status == 200 and brick.content.text is defined
             else 'Das Training konnte gerade nicht abgerufen werden.' }}
        data:
          type: tts
```

`type: tts` lässt Alexa den Text direkt sprechen (nicht `announce`, das einen Gong vorausschickt).
Echo-Lautstärke lässt sich analog zu Sonos mit `media_player.volume_set` auf der Alexa-Entität
setzen, wenn gewünscht.

### 3.4 Alexa-Routinen für die Sprachbefehle

**Wichtig:** Eine Alexa-Routine kann nur *feste* Texte sprechen – keinen dynamischen Text aus
einem Abruf. Deshalb löst die Routine nur ein HA-Skript aus, und das Skript lässt Sonos oder den
Echo den Text sprechen.

1. Je Befehl ein Skript anlegen, das `script.training_ansage` (Sonos) oder
   `script.training_ansage_alexa` (Echo) mit festem Tag aufruft:

```yaml
training_heute:
  alias: Training heute
  sequence:
    - action: script.training_ansage
      data: { day: today, detail: normal }
training_morgen:
  alias: Training morgen
  sequence:
    - action: script.training_ansage
      data: { day: tomorrow, detail: short }
training_woche:
  alias: Training Woche
  sequence:
    - action: script.training_ansage
      data: { day: week, detail: short }
```

2. Skripte für Alexa freigeben: Über **Home Assistant Cloud** (Alexa-Smart-Home, Entitäten
   freigeben) oder die manuelle Alexa-Smart-Home-Skill-Einrichtung. Danach in der Alexa-App die Geräte
   suchen; die Skripte erscheinen als Szenen.
3. In der Alexa-App unter **Mehr → Routinen** drei Routinen anlegen:

| Wenn (Stimme)                      | Aktion                              |
|-----------------------------------|-------------------------------------|
| "Was muss ich heute trainieren"   | Smart Home → Szene "Training heute"  |
| "Was steht morgen an"             | Smart Home → Szene "Training morgen" |
| "Wie sieht meine Woche aus"       | Smart Home → Szene "Training Woche"  |

Aufruf dann z. B. "Alexa, was muss ich heute trainieren?". Der Befehl wird ohne "Alexa" in die
Routine eingetragen.

### 3.5 Fehlersuche

| Symptom                                   | Prüfen                                                                                                   |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `401` / Ansage "…nicht abgerufen"         | Token mit `Bearer ` im Header? Widerrufen? Es muss ein **Sprachassistent**-Token sein (TV-Token geht nicht). |
| `429`                                     | Zu viele Abfragen (30/min je Token) oder wiederholt falscher Token. Kurz warten, Automationen prüfen.     |
| `400`                                     | `day` nur `today`/`tomorrow`/`week`, `detail` nur `short`/`normal`.                                      |
| Text leer / "nichts geplant"              | Heute nichts im Plan? Mit `curl` (siehe oben) prüfen. Datum ist Europe/Berlin.                           |
| Skript läuft, Sonos bleibt stumm          | Interne HA-URL erreichbar für Sonos? Entity-ID korrekt? Lautstärke ≠ 0? Entwicklerwerkzeuge → Aktionen: `tts.speak` direkt testen. |
| Echo bleibt stumm                         | Alexa Media Player verbunden (Integrationen → Neu anmelden)? Richtiger `notify.alexa_media_…`-Name?      |
| Routine reagiert, aber nichts passiert    | Skript in der Alexa-App als Gerät/Szene sichtbar? In HA unter Verlauf prüfen, ob das Skript lief.        |
| Antwort per `rest_command` leer           | `response_variable` gesetzt? Antwort liegt unter `brick.content.text`, Status unter `brick.status`.      |

Im HA-Log (`Einstellungen → System → Protokolle`) erscheinen `rest_command`-Fehler mit dem HTTP-Status.

## 4. Ausblick: eigener Alexa-Skill (nicht umgesetzt)

Ein eigener Custom Skill ("Alexa, frage Brick, was ich heute trainieren muss") würde Home
Assistant und die Alexa-Media-Player-Abhängigkeit überflüssig machen. Aufwand grob 2–4 Entwicklungstage plus Pflege:

- **Endpunkt** mit **Signaturprüfung**: Zertifikatskette (`SignatureCertChainUrl`), `Signature-256`-Header
  und Zeitstempel (max. 150 s Abweichung) bei jeder Anfrage prüfen – Pflicht von Amazon.
- **Account-Linking** (OAuth 2.0 Authorization Code): Brick hat mit `/api/oauth` bereits einen
  Provider für den MCP-Connector, der sich dafür erweitern ließe (Scopes, Redirect-URIs für Alexa).
- Intents (`HeuteIntent`, `MorgenIntent`, `WocheIntent`) rufen intern dieselbe Logik wie
  `/api/voice/v1/summary` auf; die Antwort wird als `outputSpeech` zurückgegeben.
- Im Entwicklungsmodus läuft der Skill ohne Zertifizierung auf dem eigenen Konto; eine
  Veröffentlichung braucht die Amazon-Zertifizierung (Datenschutz, Tests, Beschreibungen).

Dieser Weg ist bewusst **nicht** Teil dieser Änderung.
