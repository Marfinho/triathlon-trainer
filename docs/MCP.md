# Remote-MCP-Server (Claude ↔ LocalHub)

LocalHub stellt unter `POST /api/mcp` einen **MCP-Server** (Streamable HTTP, zustandslos)
bereit. Damit kann Claude die Daten *deines* Accounts lesen (z. B. für ein tägliches
Update) und – nur wenn du es erlaubst – den Trainingsplan anpassen.

Der Austausch per Copy & Paste (siehe `README.md`) funktioniert weiterhin unverändert.

## Einrichtung

### A) Als Connector in claude.ai (empfohlen)

Voraussetzungen: LocalHub ist **öffentlich per HTTPS erreichbar** (die Anfragen kommen von
Anthropics Servern, nicht aus deinem Browser) und `NEXTAUTH_URL` entspricht exakt der
öffentlichen URL (siehe `DEPLOY.md`). Die Migration läuft beim Container-Start automatisch.

1. In claude.ai: **Einstellungen → Konnektoren → Benutzerdefinierten Konnektor hinzufügen**.
2. URL eintragen: `https://DEINE-DOMAIN/api/mcp` → **Hinzufügen / Verbinden**.
3. Du wirst zu LocalHub weitergeleitet, meldest dich an und siehst die **Zustimmungsseite**:
   - Lesezugriff ist immer enthalten.
   - **„Trainingsplan ändern erlauben“** ist standardmäßig aus – nur aktivieren, wenn Claude
     den Plan anpassen soll. Für das reine Tagesupdate ausgeschaltet lassen.
4. Nach **„Zugriff erlauben“** ist der Konnektor in claude.ai verbunden und in Chats nutzbar.

Technisch: OAuth 2.1 mit Dynamic Client Registration und PKCE (S256). Access-Token gelten
1 Stunde, Refresh-Token 90 Tage (rotierend; ein wiederverwendetes Refresh-Token sperrt alle
Token dieses Clients). Erlaubte Rückleitungsziele: `https://claude.ai/…`, `https://claude.com/…`
und Loopback (`http://localhost…`); weitere Hosts nur per Env `MCP_OAUTH_REDIRECT_HOSTS`
(kommagetrennt).

**Verbindung trennen:**

```bash
docker compose exec app npx tsx scripts/mcp-token.ts revoke-oauth --email du@example.com
```

Das sperrt alle Connector-Token sofort. Zusätzlich kannst du den Konnektor in claude.ai entfernen.

### B) Mit festem Token (Claude Code, API, Skripte)

1. **Token erzeugen** (auf dem Server, im App-Container):

   ```bash
   # nur lesen (empfohlen für das tägliche Update)
   docker compose exec app npx tsx scripts/mcp-token.ts create --email du@example.com --name "Claude Lesen"

   # zusätzlich Plan ändern dürfen (apply_plan)
   docker compose exec app npx tsx scripts/mcp-token.ts create --email du@example.com --name "Claude Coach" --write

   docker compose exec app npx tsx scripts/mcp-token.ts list
   docker compose exec app npx tsx scripts/mcp-token.ts revoke <tokenId>
   ```

   Das Token (`lhm_…`) wird **nur einmal** angezeigt. In der DB liegt nur der SHA-256-Hash.
   Standardlaufzeit 365 Tage (`--days N` / `--no-expiry`).
2. **Mit Claude verbinden:**

   ```bash
   claude mcp add --transport http localhub https://DEINE-DOMAIN/api/mcp \
     --header "Authorization: Bearer lhm_…"
   ```

   Dasselbe geht in jedem MCP-Client, der einen `Authorization`-Header setzen kann
   (z. B. Claude Code in der Cloud via `.mcp.json` mit `${LOCALHUB_MCP_TOKEN}`, oder der
   MCP-Connector der Claude API mit `authorization_token`).

## Tools

| Tool | Zweck |
|---|---|
| `get_overview` | Gesamtstand fürs Tagesupdate: Form (CTL/ATL/TSB, ACWR), Wochenvolumen, Soll/Ist, Compliance, nächstes Rennen + Taper-Prognose, Readiness/Schmerz/Körper, Sync-Status |
| `get_form_series` | Tagesreihe Last/CTL/ATL/TSB |
| `get_activities` | Ist-Aktivitäten (Zeitraum, Sportart, Limit, optional Rohdaten) |
| `get_planned_workouts` | Geplante Workouts (optional mit Segmenten) |
| `get_plan_vs_actual` | Soll/Ist je Tag + Wochen-Compliance |
| `get_wellbeing` | Readiness, Schmerz, Körperwerte, Journal |
| `get_profile` | Profil/Schwellenwerte, Wochenziele, Rennen, Material |
| `get_performance_model` | Leistungsmodell & Prognosen |
| `get_nutrition` | Ernährung – nur mit in der App erteilter Einwilligung |
| `get_coach_summary` | coach_summary inkl. Planformat, Regeln, Übungskatalog (speichert nichts) |
| `validate_plan` | Plan prüfen (Dry-Run, ändert nichts) |
| `apply_plan` | Plan importieren – **nur mit `--write`-Token** |

`apply_plan` nutzt dieselbe harte Validierung wie der App-Import: Es werden nur offene
Workouts im Planzeitraum ersetzt, absolvierte Aktivitäten bleiben unangetastet; danach
läuft der Intervals.icu-Sync wie beim normalen Import.

### Beispiel: tägliches Update

> Hole mit `get_overview` meinen Stand und `get_plan_vs_actual` der letzten 7 Tage.
> Fasse Form, Belastung, Plan-Erfüllung und Readiness in 5 Sätzen zusammen und nenne
> eine Empfehlung für heute. Ändere den Plan nicht.

## Sicherheitsmodell

- **Auth:** nur `Authorization: Bearer lhm_…` (256 Bit Zufall, nur Hash gespeichert,
  widerrufbar, ablaufend), entweder fest per CLI oder per OAuth ausgestellt. Kein Cookie → kein CSRF.
  Die Zustimmungsseite prüft zusätzlich Origin und Content-Type; Codes sind einmalig, 5 Minuten
  gültig und an PKCE gebunden. Browser-Requests mit `Origin`-Header
  werden abgelehnt (Ausnahmen: `MCP_ALLOWED_ORIGINS`, kommagetrennt).
- **Mandantentrennung:** Jedes Tool ist fest an den User des Tokens gebunden; es gibt
  kein `userId`-Argument.
- **Scopes:** `read` (immer) und `write_plan` (opt-in). `apply_plan` wird ohne Scope gar
  nicht erst angeboten und prüft den Scope zusätzlich beim Aufruf.
- **Limits:** 300 Requests/Min je IP, 120/Min je Token, 10 Fehlversuche/15 Min je IP,
  20 `apply_plan`/Std je Token; Request ≤ 2 MB, Antwort ≤ 200 KB, Abfragefenster ≤ 400 Tage.
  Hinter einem Reverse-Proxy `TRUSTED_PROXY_HOPS` korrekt setzen (siehe `.env.example`/`DEPLOY.md`).
- **Audit:** Jeder Tool-Aufruf (`mcp.tool`), jede Planänderung (`mcp.apply_plan`),
  Token-Erzeugung/-Widerruf landen im `AuditLog` (nie das Token selbst).
- **Prompt-Injection:** Notizen, Journal, Titel und von Strava/Intervals importierte Texte
  sind Fremddaten und könnten Anweisungen enthalten. Deshalb ist der Schreibzugriff
  opt-in; nutze für das reine Tagesupdate ein **Read-only-Token**.
- **Ernährung:** wird – wie in der App – nur mit gesetzter Einwilligung (DSGVO Art. 9)
  ausgeliefert.
