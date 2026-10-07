# TV-API (Fire TV / Android-TV-Client)

Vertrag zwischen Brick (LocalHub) und der separaten Android-TV-App (`brick-tv`).
Die App koppelt sich per **Device Authorization Grant (RFC 8628)** und arbeitet danach
mit einem **Geräte-Token** (`lht_…`). Basis-URL = die LocalHub-URL (`NEXTAUTH_URL`).

## 1. Kopplung

```
TV                                   Brick                           Handy/Browser (eingeloggt)
 │ POST /api/device/code ───────────▶│
 │◀── device_code, user_code, URIs ──│
 │  zeigt Code "K7QM" + QR           │
 │                                   │◀── /device?code=K7QM (QR) oder Code tippen
 │                                   │◀── POST /api/device/verify (lookup, approve)
 │ POST /api/device/token (Polling) ▶│
 │◀── authorization_pending ─────────│
 │ …                                 │
 │◀── access_token (einmalig) ───────│
```

### `POST /api/device/code` (öffentlich)
Body (optional): `{ "device_name": "Fire TV Wohnzimmer" }` – erlaubt sind Buchstaben, Ziffern,
Leerzeichen und `._()-`, max. 40 Zeichen (der Name wird dem Nutzer bei der Bestätigung gezeigt).

```json
{
  "device_code": "…43 Zeichen, geheim…",
  "user_code": "K7QM",
  "verification_uri": "https://brick.example/device",
  "verification_uri_complete": "https://brick.example/device?code=K7QM",
  "expires_in": 600,
  "interval": 5
}
```
- **Anzeige:** `user_code` groß (4 Zeichen aus `A–Z 2–9` ohne `I`/`O`), daneben ein QR-Code mit
  `verification_uri_complete`. Der QR führt auf die Brick-Seite, der Nutzer loggt sich bei Bedarf ein
  und bestätigt – ohne Tippen.
- Limit: 20 Anfragen / 10 min je IP (`429 slow_down`).

### `POST /api/device/token` (öffentlich, Polling)
Body JSON oder `application/x-www-form-urlencoded`:
`device_code` (Pflicht), `grant_type = urn:ietf:params:oauth:grant-type:device_code` (optional).

| HTTP | Antwort                                   | Bedeutung / Reaktion der App                                  |
|------|-------------------------------------------|---------------------------------------------------------------|
| 200  | `{ access_token, token_type:"Bearer", scope:"tv", device_name }` | Fertig. Token sicher speichern, Polling beenden. |
| 400  | `{ "error": "authorization_pending" }`    | Weiter pollen (alle `interval` Sekunden).                     |
| 400  | `{ "error": "slow_down", "interval": 10 }`| Intervall auf den genannten Wert erhöhen.                     |
| 400  | `{ "error": "access_denied" }`            | Nutzer hat abgelehnt → neuen Code anbieten.                   |
| 400  | `{ "error": "expired_token" }`            | Code abgelaufen (10 min) → neuen Code holen.                  |
| 400  | `{ "error": "invalid_grant" }`            | Unbekannt oder bereits eingelöst → neu starten.               |
| 429  | `{ "error": "slow_down" }`                | Zu viele Anfragen (120/min je IP).                            |

Der Token wird **genau einmal** ausgegeben. Er ist unbefristet gültig, bis der Nutzer ihn unter
*Profil → Gekoppelte Geräte* widerruft oder die App `POST /api/tv/v1/logout` aufruft.

## 2. Authentifizierte Endpunkte

Header: `Authorization: Bearer lht_…`. `401 invalid_token` ⇒ Token widerrufen → App muss neu koppeln.
Limit: 240 Anfragen/min je Token. Der Geräte-Token gilt **nur** für die hier genannten Routen
(Scope `tv`), nicht für die übrige API und nicht für den MCP-Endpunkt.

### `GET /api/tv/v1/workouts?days=21`
Einheiten der nächsten `days` Tage (Standard 21, max. 60) sowie von gestern.

```json
{
  "device": { "name": "Fire TV Wohnzimmer" },
  "athlete": {
    "name": "…", "ftpWatts": 250, "thresholdHr": 170,
    "powerZones": [ … ], "hrZones": [ … ]
  },
  "bike": [{
    "id": "…", "date": "2026-10-08", "title": "Sweetspot 3×12", "sport": "bike",
    "plannedDurationMin": 60,
    "segments": [ … Rohsegmente wie im Plan … ],
    "timeline": {
      "ftp": 250, "totalDurationSec": 3600,
      "steps": [{ "index": 0, "startSec": 0, "endSec": 600, "durationSec": 600,
                  "targetWatts": 140, "rangeWatts": [130, 150], "label": "1. warmup", "source": "…" }]
    }
  }],
  "strength": [{
    "id": "…", "date": "…", "title": "Rumpf & Hüfte", "sport": "strength", "plannedDurationMin": 30,
    "steps": [
      { "kind": "exercise", "exerciseId": "side-plank", "title": "Seitstütz", "dose": "3 × 30 s pro Seite",
        "note": null, "sets": 3, "reps": null, "holdSec": 30, "restSec": 20, "perSide": true },
      { "kind": "text", "segmentType": "warmup", "description": "…", "durationSec": 300 }
    ]
  }]
}
```
- `timeline` ist serverseitig mit der FTP des Athleten berechnet (`targetWatts` = ERG-Ziel je Schritt;
  Ruhe-Schritte = 0 W). Die App kann sie direkt abspielen und braucht die Segment-Logik nicht zu portieren;
  bei FTP-Override in der App neu berechnen (`segments` + Regeln aus `src/integrations/trainer/watts.ts`).
- Der Ablauf einer Kraft-Einheit (Sätze, Seiten, Halte-/Pausen-Countdown) folgt
  `src/components/exercises/strengthPlayerState.ts`.

### `POST /api/tv/v1/activities`
Aufgezeichnete Einheit speichern. Body wie `POST /api/activities`:
`{ sport, date?, durationMin, distanceKm?, load?, avgHr?, avgPower?, rpe?, notes?, samples?, externalId? }`
(`source` ist standardmäßig `"tv"`). **`externalId` (UUID) immer setzen:** Der Upload ist damit idempotent,
ein Wiederholen nach Netzausfall liefert `{ ok:true, id, duplicate:true }` statt eines Duplikats.
`samples`: bis zu 50 000 Einträge (`downsample` wie in `recording.ts` empfohlen, ~300).

### Brick-Bereiche (lesen)
Alle mit `Cache-Control: no-store`; Zahlen roh, Formatierung macht die App. Logik wie Web-App/MCP
(`src/lib/tv/sections.ts`).

| Route | Inhalt |
|---|---|
| `GET /api/tv/v1/today` | `date`, `athleteName`, `planned[]` (inkl. `kind: bike/strength/other` = in der App abspielbar), `done[]`, `form` (`ctl/atl/tsb/acwr`, `label`, `acwrLabel`), `readiness` (letzter Check-in), `painLatest`, `nextRace` (`countdown`, `phase`), `taper`, `weeklyGoals[]` (`sport, targetMin, actualMin, pct`) |
| `GET /api/tv/v1/week` | `days[]` (28 Tage ab Montag der Vorwoche; `items[]` geplant/absolviert, `playable`), `weeklyGoals[]`, `compliance[]` (je Woche), `recent[]` (letzte 15 Aktivitäten) |
| `GET /api/tv/v1/race` | `races[]` (`daysToRace`, `countdown`, `phase`, `forecast { label, fastSec, likelySec, slowSec, confidence }`), `capacity { run, bike, swim }` (Text) |
| `GET /api/tv/v1/extras` | `zones[]` (Leistung/HF/Pace), `seasonStats`, `body` (Gewicht/Ruhepuls/HRV-Verlauf), `gear[]` (flach, `depth`, `km`, `kmPct`, `status`), `journal[]` |
| `GET /api/tv/v1/profile` | `name`, `email`, `plan`, `athlete` (Schwellenwerte), `weeklyGoals[]`, `integrations[]` |

### Brick-Bereiche (mit der Fernbedienung ändern)
| Route | Body | Hinweis |
|---|---|---|
| `POST /api/tv/v1/checkin` | wie `POST /api/checkin`: `{ readiness?: { status: green/yellow/red, subjectiveFatigue 1–10, sleepTrend: besser/gleich/schlechter }, pain?: { overall 0–10 } }` | neuer Snapshot, nichts wird überschrieben |
| `POST /api/tv/v1/goals` | `{ sport, weeklyTargetMin }` (0–3000) | Upsert je Disziplin |
| `PATCH /api/tv/v1/profile` | Teilmenge `{ ftpWatts 50–600, thresholdHr 80–230, weightKg 30–250 }` | legt das Athletenprofil bei Bedarf an |
| `POST /api/tv/v1/body` | `{ weightKg?, restingHr? }` | neuer Körperwerte-Eintrag |

### Übungsanimation (WebView)
`GET /tv/exercise/{exerciseId}` – randlose, dunkle Seite nur mit dem 3D-Modell (Format 2.0,
`Exercise3dViewer`, WebGL mit SVG-Fallback) bzw. der 2D-Animation (1.x). Für die Kraft-Einheit
der App in einer WebView; die App sendet beim Laden `Authorization: Bearer lht_…`. Eigene Übungen
nur für den eigenen Nutzer.

### `POST /api/tv/v1/logout`
Widerruft den eigenen Token (App-Funktion „Abmelden“). Antwort `{ ok: true }`.

### Live-Zustand (optional)
`POST /api/live` (Body = Snapshot, siehe `src/lib/live-session.ts`), `GET /api/live`,
`GET /api/live/stream` (SSE) akzeptieren ebenfalls den Geräte-Token. So kann die TV-Web-Ansicht
(`/trainer/tv`) auf einem zweiten Gerät mitlaufen.

## 3. Verwaltung (Browser, Session)
- `/device` – Code eingeben bzw. QR-Ziel; Bestätigen/Ablehnen. Login-pflichtig.
- `POST /api/device/verify` `{ user_code, action: "lookup"|"approve"|"deny" }` – 20 Versuche / 15 min je Nutzer.
- `GET /api/device/tokens`, `DELETE /api/device/tokens { id }` – Geräteliste, Entkoppeln
  (auch in *Profil → Gekoppelte Geräte*).

## 4. Sicherheit
- `device_code` und Geräte-Token werden nur als SHA-256-Hash gespeichert.
- Kurzcode: 32⁴ ≈ 1,05 Mio. Möglichkeiten, 10 min gültig, einmalig, nur mit Login prüfbar und je Nutzer
  rate-limitiert. Ein erratener Code bindet ein fremdes Gerät höchstens an das Konto des Rätenden;
  er gibt keinen Zugriff auf fremde Daten. Die Bestätigungsseite zeigt Gerätename und Alter der Anfrage.
- Token-Präfix `lht_` ≠ MCP-Präfix `lhm_`: ein TV-Token ist am MCP-Endpunkt wertlos und umgekehrt.
- Geräte-Token werden **nicht** von `requireUser()` akzeptiert; nur Routen mit `requireUserOrDevice`
  (`/api/tv/*`, `/api/live*`) öffnen sich dafür.
- Die App muss den Token verschlüsselt ablegen (Android Keystore / `EncryptedSharedPreferences`).
