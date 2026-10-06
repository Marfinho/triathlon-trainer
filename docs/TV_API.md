# TV-API (brick-tv)

Schnittstelle für die native Fire-TV-App **brick-tv** (Repo `Marfinho/brick-tv`).
Die App koppelt sich per **Device Authorization Grant (RFC 8628)**, lädt geplante
Rad- und Kraft-Einheiten, steuert den Rollentrainer selbst per Bluetooth und lädt
die Aufzeichnung als Aktivität hoch.

Alle Antworten sind JSON mit `Cache-Control: no-store`. Zeiten sind ISO-8601,
Datumswerte `YYYY-MM-DD`.

## 1. Kopplung (RFC 8628)

### `POST /api/device/code` (öffentlich, 20 Anfragen / 15 min / IP)

Body (JSON oder `application/x-www-form-urlencoded`, optional):

```json
{ "client_name": "Fire TV Wohnzimmer" }
```

Antwort `200`:

```json
{
  "device_code": "…43 Zeichen, geheim…",
  "user_code": "BCDF-GHJK",
  "verification_uri": "https://brick.example/device",
  "verification_uri_complete": "https://brick.example/device?code=BCDF-GHJK",
  "expires_in": 600,
  "interval": 5
}
```

Die App zeigt `verification_uri_complete` als QR-Code und `user_code` zum Abtippen.
Der user_code besteht aus 8 Zeichen des Alphabets `BCDFGHJKLMNPQRSTVWXZ`
(keine Vokale, nichts Verwechselbares). Groß-/Kleinschreibung und Bindestrich
sind bei der Eingabe egal.

### `GET /device?code=…` (Login nötig)

Freigabeseite im Browser (Handy/Laptop). Der Nutzer bestätigt den Code. Die Seite
listet außerdem die gekoppelten Geräte und kann sie entkoppeln.

### `POST /api/device/token` (öffentlich)

Body (Form oder JSON):

```
grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=…
```

| Status | Body | Bedeutung für die App |
|---|---|---|
| 200 | `{ "access_token": "lht_…", "token_type": "Bearer", "scope": "tv" }` | gekoppelt, Token speichern |
| 400 | `{ "error": "authorization_pending" }` | weiter pollen (`interval`) |
| 400 | `{ "error": "slow_down" }` | Intervall um 5 s erhöhen |
| 400 | `{ "error": "access_denied" }` | Nutzer hat abgelehnt → neuer Code |
| 400 | `{ "error": "expired_token" }` | Code abgelaufen → neuer Code |
| 400 | `{ "error": "invalid_grant" }` | unbekannt/bereits eingelöst → neuer Code |

Ein freigegebener Code wird genau einmal eingelöst.

### Token

- Präfix `lht_`, 256 Bit Zufall. Der Server speichert nur den SHA-256-Hash.
- Kein Ablaufdatum. Widerruf über `/device` (Entkoppeln) oder `POST /api/tv/logout`.
- Jede TV-Route antwortet bei fehlendem/ungültigem/widerrufenem Token mit
  **`401 { "error": "invalid_token" }`** und `WWW-Authenticate: Bearer error="invalid_token"`.
  Die App löscht dann das Token und startet die Kopplung neu.
- Mehr als 30 Fehlversuche je IP in 15 min → `429` mit `Retry-After`.

## 2. TV-Routen (`Authorization: Bearer lht_…`)

### `GET /api/tv/me`

```json
{
  "name": "Sven",
  "ftpWatts": 250,
  "thresholdHr": 168,
  "device": { "id": "clx…", "name": "Fire TV Wohnzimmer" }
}
```

`ftpWatts` kann `null` sein. Die App nutzt dann 200 W und weist darauf hin.

### `GET /api/tv/workouts?days=14`

Geplante Einheiten (Status `planned`/`synced`) von gestern bis `days` Tage voraus
(1–28). Rad (`bike`, `brick`) → `kind: "bike"`, Kraft/Mobility (`strength`,
`mobility`, `other` oder Einheiten mit Übungssegmenten) → `kind: "strength"`.

```json
{
  "workouts": [
    {
      "id": "clx…",
      "date": "2026-10-07",
      "sport": "bike",
      "kind": "bike",
      "title": "Sweet Spot 3×10",
      "plannedDurationMin": 60,
      "description": null,
      "segments": [
        {
          "type": "warmup", "durationSec": 600, "intensity": "warmup",
          "targetType": null, "targetValue": null, "targetValueTo": null,
          "rpeTarget": null, "cadenceNote": null, "description": null
        },
        {
          "type": "interval", "durationSec": 600, "intensity": null,
          "targetType": "power", "targetValue": 225, "targetValueTo": 235,
          "rpeTarget": null, "cadenceNote": "90 rpm", "description": "Sweet Spot"
        }
      ],
      "steps": []
    },
    {
      "id": "cly…",
      "date": "2026-10-08",
      "sport": "strength",
      "kind": "strength",
      "title": "Rumpf",
      "plannedDurationMin": 20,
      "description": null,
      "segments": [],
      "steps": [
        { "kind": "text", "title": "Aufwärmen", "description": "Locker einrollen", "durationSec": 300 },
        {
          "kind": "exercise", "exerciseId": "side-plank", "title": "Seitstütz",
          "dose": "3 × 30 s pro Seite", "sets": 3, "reps": null, "holdSec": 30,
          "restSec": 20, "perSide": true, "loadKg": null, "note": null, "description": null
        }
      ]
    }
  ]
}
```

Die Ziel-Watt eines Rad-Segments ermittelt die App selbst, mit derselben Logik wie
`src/integrations/trainer/watts.ts`: Power-Target, dann Zone, dann RPE, dann Default.
`type: "rest"` bedeutet 0 W. Segmente ohne `durationSec > 0` werden übersprungen.

Kraft-Schritte: `holdSec` ist nur gesetzt, wenn es keine `reps` gibt (Halteübung).
Ablauf wie `src/components/exercises/strengthPlayerState.ts`.

### `POST /api/tv/activities`

Upload einer aufgezeichneten Einheit. Body wie `POST /api/activities` plus
**`clientId`** (8–64 Zeichen `[A-Za-z0-9_-]`, von der App pro Einheit erzeugt):

```json
{
  "clientId": "3f9c2b1e-…",
  "sport": "bike",
  "date": "2026-10-07T17:30:00.000Z",
  "durationMin": 61.5,
  "distanceKm": 31.2,
  "load": 72,
  "avgHr": 142,
  "avgPower": 201,
  "notes": "Brick TV: Sweet Spot 3×10",
  "samples": [{ "tSec": 0, "powerW": 120, "cadenceRpm": 85, "hrBpm": 110, "speedKmh": 28.1, "targetW": 140 }]
}
```

- `201 { "ok": true, "id": "…", "duplicate": false }`: angelegt.
- `200 { "ok": true, "id": "…", "duplicate": true }`: diese `clientId` gibt es schon.
  Die App sendet nach Netzausfall erneut, deshalb ist der Upload idempotent.
- `400` bei ungültigem Body, `413` ab 2 MB.

Gespeichert wird als `ActualActivity` mit `source = "brick-tv"` und
`externalId = clientId`. Samples höchstens 50 000, die App schickt auf 600 Punkte
reduziert.

### `POST /api/tv/live`

Optional: Live-Zustand im Format von `POST /api/live` (`src/lib/live-session.ts`),
damit `/trainer/tv` auf weiteren Bildschirmen mitläuft. `{ "kind": "idle" }` beendet
die Anzeige.

### `POST /api/tv/logout`

Widerruft das eigene Token (Abmelden in der App). Antwort `200 { "ok": true }`.

## 3. Sicherheit

- Der device_code ist geheim und liegt nur als Hash in der DB. Der user_code ist
  10 min gültig und wird nur einmal eingelöst.
- Freigeben (`POST /api/device/approve`) verlangt eine Session und ist gedrosselt
  (20 Versuche / 15 min / Nutzer) gegen Durchprobieren.
- Kopplung, Logout und Widerruf landen im Audit-Log (`device.paired`, `device.logout`,
  `device.revoked`).
- Geräte-Token gelten nur für `/api/tv/*`, nicht für `/api/mcp` oder die Web-App.
