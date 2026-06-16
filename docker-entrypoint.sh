#!/bin/sh
set -e

# Auf PostgreSQL warten und Migrationen anwenden – idempotent.
# Der db-Dienst kann beim Start noch nicht erreichbar sein, daher mit Retry.
echo "[localhub] Warte auf Datenbank und wende Migrationen an…"
i=1
until npx prisma migrate deploy; do
  if [ "$i" -ge 30 ]; then
    echo "[localhub] Datenbank nach $i Versuchen nicht erreichbar – Abbruch."
    exit 1
  fi
  echo "[localhub] Datenbank noch nicht bereit (Versuch $i/30) – erneuter Versuch in 2s…"
  i=$((i + 1))
  sleep 2
done

# Optionales Seeding beim ersten Start (per Umgebungsvariable steuerbar).
if [ "${SEED_ON_START}" = "true" ]; then
  echo "[localhub] Seede Demodaten…"
  npx prisma db seed || echo "[localhub] Seed übersprungen/fehlgeschlagen (ggf. bereits Daten vorhanden)."
fi

echo "[localhub] Starte Anwendung auf Port ${PORT:-3000}…"
exec "$@"
