# Remote-MCP-Server (Claude ↔ LocalHub)

LocalHub stellt unter `POST /api/mcp` einen **MCP-Server** (Streamable HTTP, zustandslos)
bereit. Damit kann Claude die Daten *deines* Accounts lesen (z. B. für ein tägliches
Update) und – nur wenn du es erlaubst – den Trainingsplan anpassen.

Der Austausch per Copy & Paste (siehe `README.md`) funktioniert weiterhin unverändert.

## Einrichtung

1. **Migration** einspielen (beim Container-Start automatisch: `prisma migrate deploy`).
2. **Token erzeugen** (auf dem Server, im App-Container):

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
3. **Mit Claude verbinden** (HTTPS-Reverse-Proxy vorausgesetzt, siehe `DEPLOY.md`):

   ```bash
   claude mcp add --transport http localhub https://DEINE-DOMAIN/api/mcp \
     --header "Authorization: Bearer lhm_…"
   ```

   Dasselbe geht in jedem MCP-Client, der einen `Authorization`-Header setzen kann
   (z. B. Claude Code in der Cloud via `.mcp.json` mit `${LOCALHUB_MCP_TOKEN}`, oder der
   MCP-Connector der Claude API mit `authorization_token`).

   > Nicht Teil dieser Umsetzung: OAuth. Die Connector-Oberfläche von claude.ai verlangt
   > nach aktuellem Kenntnisstand OAuth bzw. gar keine Auth und kann deshalb dieses
   > Bearer-Token nicht verwenden.

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
  widerrufbar, ablaufend). Kein Cookie → kein CSRF. Browser-Requests mit `Origin`-Header
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
