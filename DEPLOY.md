# Deployment – Auto-Deploy via GitHub Actions → SSH (eigener Linux-VPS)

Bei jedem Merge nach `main` läuft die Pipeline `.github/workflows/deploy.yml`:

1. **CI-Gate:** `npm ci` → `prisma generate` → `tsc --noEmit` → Tests (gegen einen
   Postgres-Service) → `next build`.
2. **Deploy:** Nur bei grünem CI verbindet sich GitHub Actions per SSH zum VPS,
   holt den neuesten `main`-Stand und startet den Stack via Docker Compose neu.
   Datenbank-Migrationen laufen automatisch beim Container-Start
   (`docker-entrypoint.sh` → `prisma migrate deploy`).

Es geht **kein SSH-Key durch den Chat** – alles liegt in GitHub-Secrets.

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

Optional je nach genutzten Features: `GOOGLE_*`, `STRIPE_*`, `INTERVALS_*`,
`STRAVA_*`/`WAHOO_*`/`WITHINGS_*`, `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`.

> Hinweis: In `docker-compose.yml` wird `DATABASE_URL` automatisch aus den
> `POSTGRES_*`-Werten zusammengesetzt (Host = Service `db`). Die `DATABASE_URL`
> in `.env` ist nur für lokale Nutzung ohne Docker relevant.

### Erststart testen

```bash
docker compose up -d --build
docker compose logs -f app   # Migrationen + Start beobachten
```

Die App lauscht intern auf Port **3000** (gemappt auf Host `3000:3000`).

---

## 2. SSH-Deploy-Key (für GitHub Actions)

Auf einem lokalen Rechner ein **dediziertes** Schlüsselpaar nur für Deploys
erzeugen (kein persönlicher Key):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""
```

- **Öffentlichen** Teil (`deploy_key.pub`) auf dem Server beim Deploy-User
  hinterlegen:
  ```bash
  # auf dem VPS, als 'deploy'
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  echo "<INHALT VON deploy_key.pub>" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  ```
- **Privaten** Teil (`deploy_key`) als GitHub-Secret `SSH_PRIVATE_KEY` speichern
  (siehe unten). Danach die lokale Datei sicher löschen.

---

## 3. GitHub-Secrets setzen

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Beispiel / Beschreibung |
|---|---|
| `SSH_HOST` | IP oder Hostname des VPS |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | `22` (oder dein abweichender Port) |
| `SSH_PRIVATE_KEY` | kompletter Inhalt von `deploy_key` |
| `DEPLOY_PATH` | `/opt/triathlon-trainer` |

Danach löst jeder Merge nach `main` automatisch den Deploy aus. Manuell:
**Actions → CI & Deploy → Run workflow**.

---

## 4. HTTPS / Reverse Proxy (empfohlen)

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

## 5. Betrieb

```bash
docker compose ps                 # Status
docker compose logs -f app        # Live-Logs
docker compose down               # Stoppen (DB-Volume bleibt erhalten)
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql  # DB-Dump
```

Migrationen müssen nicht manuell ausgeführt werden – sie laufen idempotent bei
jedem Container-Start. Das Postgres-Volume `localhub-db` überlebt Redeploys.
