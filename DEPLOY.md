# Deployment – manuell per Docker Compose (eigener Linux-VPS)

Deployt wird bewusst **manuell** auf dem Server: neuesten `main`-Stand holen und
den Docker-Stack neu bauen. Datenbank-Migrationen laufen automatisch beim
Container-Start (`docker-entrypoint.sh` → `prisma migrate deploy`).

GitHub Actions (`.github/workflows/ci.yml`) prüft nur – Typecheck, Tests gegen
einen Postgres-Service und `next build` bei jedem Push auf `main` und bei Pull
Requests – und greift nicht auf den Server zu.

---

## 1. Einmalige Server-Vorbereitung (VPS)

Voraussetzungen auf dem VPS: **Docker Engine + Compose-Plugin** und **git**.

```bash
# Docker (offizielles Convenience-Skript) + git
curl -fsSL https://get.docker.com | sh
sudo apt-get update && sudo apt-get install -y git

# Deploy-Benutzer (empfohlen, statt root) und Docker-Rechte
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo su - deploy

# Repository klonen (HTTPS reicht; bei privatem Repo Deploy-Token/SSH nutzen)
git clone https://github.com/Marfinho/triathlon-trainer.git /opt/triathlon-trainer
cd /opt/triathlon-trainer
git checkout main
```

### `.env` auf dem Server anlegen

```bash
cp .env.example .env
nano .env
```

Mindestens setzen (Secrets mit `openssl rand -base64 32` erzeugen):

| Variable | Wert |
|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | DB-Zugang (Passwort stark wählen) |
| `NEXTAUTH_URL` | öffentliche HTTPS-URL, z. B. `https://app.deinedomain.de` |
| `NEXTAUTH_SECRET` | zufälliges Secret |
| `ENCRYPTION_KEY` | zufälliges Secret (für gespeicherte OAuth-Tokens) |
| `CRON_SECRET` | zufälliges Secret (schützt `/api/cron/sync`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional: SMTP-Zugang für E-Mail-Bestätigung & Passwort-Reset. Ohne `SMTP_HOST` sind neue Konten sofort aktiv |
| `TRUSTED_PROXY_HOPS` | Anzahl eigener Reverse-Proxys vor der App (Default `1`, für korrekte Client-IP im Rate-Limit) |

Optional je nach genutzten Features: `GOOGLE_*`, `STRIPE_*`, `INTERVALS_*`,
`STRAVA_*`/`WAHOO_*`/`WITHINGS_*`.

> Hinweis: In `docker-compose.yml` wird `DATABASE_URL` automatisch aus den
> `POSTGRES_*`-Werten zusammengesetzt (Host = Service `db`). Die `DATABASE_URL`
> in `.env` ist nur für lokale Nutzung ohne Docker relevant.

### Admin-Zugang

Admin ist der Nutzer mit der E-Mail `svenmeendermann@gmail.com`: einfach
registrieren oder per Google anmelden – die Admin-Rolle wird beim Login
automatisch gesetzt und kann im Admin-Panel nicht entzogen werden.

### Erststart testen

```bash
docker compose up -d --build
docker compose logs -f app   # Migrationen + Start beobachten
```

Die App lauscht intern auf Port **3000** (gemappt auf Host `3000:3000`).

---

## 2. Update einspielen

Auf dem VPS im Repo-Ordner:

```bash
cd /opt/triathlon-trainer
git pull origin main
docker compose up -d --build
docker image prune -f          # optional: alte Images aufräumen
docker compose logs -f app     # Migrationen + Start beobachten
```

Am besten erst deployen, wenn der CI-Lauf für den Commit auf GitHub grün ist.

### Update per Button im Admin-Panel

Im Admin-Panel gibt es die Karte **„System-Update“**: „Auf Updates prüfen“ holt
den Stand von GitHub, „Jetzt aktualisieren“ macht `git pull --ff-only` und baut
nur den Dienst `app` neu (Migrationen laufen beim Start wie gewohnt). Schlägt der
Build fehl, wird der Code zurückgesetzt und die laufende Version bleibt aktiv.

So funktioniert es: Der Dienst **`updater`** (siehe `updater/`) hat den
Docker-Socket und das Repo (`.:/repo`) gemountet; die App legt nur eine
Anfrage-Datei im geteilten Volume `localhub-updates` ab und hat selbst keinen
Docker-Zugriff. Hinweise:

- Der Docker-Socket entspricht Root auf dem Host – der Updater hat keinen
  Port nach außen, die Auslöser-Route ist admin-geschützt und wird im Audit-Log
  protokolliert.
- Der Branch ist per `UPDATE_BRANCH` (Default `main`) einstellbar.
- Bei privatem Repo muss `git pull` auf dem Server ohne Passwort funktionieren
  (Token in der `origin`-URL oder Deploy-Key).
- Der Updater aktualisiert sich nicht selbst; nach Änderungen an `updater/`
  einmalig manuell `docker compose up -d --build updater`.
- Lokale Änderungen im Repo auf dem Server brechen das Update ab.

---

## 3. HTTPS / Reverse Proxy (empfohlen)

Die App liefert HTTP auf Port 3000. Für HTTPS einen Reverse Proxy davorsetzen –
am einfachsten **Caddy** (automatische Let’s-Encrypt-Zertifikate). Beispiel
`/etc/caddy/Caddyfile`:

```
app.deinedomain.de {
    reverse_proxy localhost:3000
}
```

DNS-A-Record der Domain auf die VPS-IP zeigen lassen. `NEXTAUTH_URL` muss exakt
der öffentlichen HTTPS-URL entsprechen, sonst schlagen Auth-Redirects fehl.

---

## 4. Betrieb

```bash
docker compose ps                 # Status
docker compose logs -f app        # Live-Logs
docker compose down               # Stoppen (DB-Volume bleibt erhalten)
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql  # DB-Dump
```

Migrationen müssen nicht manuell ausgeführt werden – sie laufen idempotent bei
jedem Container-Start. Das Postgres-Volume `localhub-db` überlebt Updates.

## MCP-Zugriff für Claude (optional)

Der Endpunkt `POST /api/mcp` ist nach dem Deploy sofort vorhanden, aber nutzlos ohne Token.
Als Connector in claude.ai hinzufügen (OAuth, kein manuelles Token nötig) oder per Token verbinden:
siehe [`docs/MCP.md`](docs/MCP.md). Dafür muss die App öffentlich per HTTPS erreichbar und `NEXTAUTH_URL` korrekt gesetzt sein.
Der Reverse-Proxy muss `X-Forwarded-For` setzen (Caddy tut das standardmäßig); bei mehr als
einem Proxy-Hop `TRUSTED_PROXY_HOPS` setzen, sonst greifen die Rate-Limits je IP nicht korrekt.

## Launch-Checkliste für öffentliche Registrierung

1. **Rechtliches:** `LEGAL_NAME`, `LEGAL_STREET`, `LEGAL_CITY`, `LEGAL_EMAIL` (optional `LEGAL_PHONE`, `LEGAL_VAT_ID`) setzen –
   sie füllen Impressum, AGB und Datenschutz. Die AGB-/Datenschutz-Texte sind Entwürfe: rechtlich prüfen lassen
   (Widerruf, Auftragsverarbeitungsverträge mit SMTP-Anbieter, Stripe, Hoster).
2. **Mail:** SMTP im Admin-Bereich („Mail-Versand“) oder per `SMTP_*`-Variablen einrichten und die Testmail senden.
   Für die Absenderdomain **SPF, DKIM und DMARC** im DNS eintragen (Werte liefert der SMTP-Anbieter), sonst landen
   Bestätigungsmails im Spam.
3. **Secrets:** `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET` mit `openssl rand -base64 32` erzeugen; `NEXTAUTH_URL` auf die
   öffentliche HTTPS-URL setzen.
4. **Stripe:** Live-Keys, Preis-IDs und Webhook (`/api/billing/webhook`) konfigurieren; einen Testkauf und eine Kündigung durchspielen.
5. **Backups:** regelmäßiger `pg_dump` des Postgres-Volumes (z. B. täglich per Cron, mit Wiederherstellungstest) und Offsite-Kopie.
6. **Monitoring:** Uptime-Check auf `/` sowie Container-Logs/Fehler-Tracking (z. B. Sentry) anbinden.
7. **Google-Login:** OAuth-Zustimmungsbildschirm veröffentlichen und die Redirect-URI `${NEXTAUTH_URL}/api/auth/callback/google` eintragen.
