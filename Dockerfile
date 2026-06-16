# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# LocalHub – Container-Image (Next.js + Prisma + PostgreSQL)
#
# Multi-Stage:
#   deps   – Abhängigkeiten + Prisma-Client generieren
#   build  – Next.js Produktionsbuild
#   runner – schlankes Laufzeit-Image; migriert beim Start und startet die App
# ---------------------------------------------------------------------------

FROM node:22-slim AS base
WORKDIR /app
# OpenSSL wird von Prisma benötigt.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Abhängigkeiten (inkl. Dev, für Build + Migration/Seed zur Laufzeit) ---
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
# Prisma-Schema vor `npm ci` kopieren, damit das postinstall (prisma generate) läuft.
COPY prisma ./prisma
RUN npm ci

# --- Build ---
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy-URL nur für den Build (Seiten sind dynamisch, keine echte DB nötig).
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/localhub"
RUN npm run build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# DATABASE_URL wird zur Laufzeit über die Compose-Umgebung gesetzt.

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.ts ./
COPY prisma ./prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
