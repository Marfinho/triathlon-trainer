#!/bin/sh
set -e

# Schema auf die (persistente) SQLite-DB anwenden – idempotent.
echo "[localhub] Wende Datenbank-Migrationen an…"
npx prisma migrate deploy

# Optionales Seeding beim ersten Start (per Umgebungsvariable steuerbar).
if [ "${SEED_ON_START}" = "true" ]; then
  echo "[localhub] Seede Demodaten…"
  npx prisma db seed || echo "[localhub] Seed übersprungen/fehlgeschlagen (ggf. bereits Daten vorhanden)."
fi

echo "[localhub] Starte Anwendung auf Port ${PORT:-3000}…"
exec "$@"
