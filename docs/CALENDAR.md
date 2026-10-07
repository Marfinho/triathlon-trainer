# Kalender-Feed (ICS)

Brick stellt deinen Trainingsplan als **ICS-Feed** bereit, den Kalender-Apps abonnieren können
(Google Kalender, Apple Kalender, Outlook, Home Assistant).

```
GET /api/calendar/v1/training.ics?token=lht_…
```

- Enthalten: geplante Einheiten von 14 Tagen zurück bis 120 Tage voraus, dazu kommende Wettkämpfe.
  Übersprungene, abgesagte und ersetzte Einheiten fehlen. Erledigte beginnen mit "Erledigt: ".
- Ganztägige Ereignisse (Einheiten haben keine Uhrzeit), Titel z. B. `Radfahren 1:20 h - Grundlagen`.
- Keine Gesundheits-, Schmerz- oder Readiness-Daten. Die Ereignis-Kennungen (`UID`) sind gehasht, keine Datenbank-IDs.
- Refresh-Hinweis an die Clients: stündlich. Viele Clients (v. a. Google) aktualisieren abonnierte Feeds
  nur alle paar Stunden – das kann Brick nicht beeinflussen.

## Token

Profil → Gekoppelte Geräte → Art **Kalender (ICS)** → "Kalender-Token erzeugen". Brick zeigt die
**fertige Feed-URL einmalig** an (mit Kopieren-Knopf). Kalender-Clients können keinen Header senden,
deshalb steckt der Token in der URL; alternativ akzeptiert der Endpunkt `Authorization: Bearer lht_…`.

- Der Token hat den eigenen Scope `calendar`: Er öffnet nur diesen Feed – nicht die TV-API, nicht den
  Sprechtext, nichts anderes. Umgekehrt öffnen tv- und voice-Token den Feed nicht.
- **Behandle die URL wie ein Passwort.** Wer sie kennt, sieht deinen Plan. Teile sie nicht, poste sie nicht in
  Screenshots. Bei Verdacht: im Profil **Entkoppeln** und neu erzeugen.
- Die Antwort ist `no-store`, 60 Abfragen pro Minute je Token.

## Einbinden

- **Google Kalender:** Weitere Kalender → Per URL → Feed-URL einfügen (nur im Web).
- **Apple Kalender:** Ablage → Neues Kalenderabonnement.
- **Home Assistant:** Integration "Remote Calendar" mit der Feed-URL.
