# --- Stage 1: Dependencies ---
FROM node:24-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build ---
FROM node:24-bookworm-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BUILD_NUMBER
ENV BUILD_NUMBER=${BUILD_NUMBER}

RUN npm run build

# --- Stage 3: Runner ---
FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# postgresql-client-16 stellt `pg_restore` bereit, das startup.js für den
# Drop-in-Restore benutzt (siehe /backups/restore.backup). `tar` ist bereits
# in bookworm-slim enthalten und wird für das Auspacken der Backup-Datei
# verwendet. Die Version (16) muss zur DB-Version passen, daher PGDG.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && apt-get purge -y --auto-remove curl gnupg \
 && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Static assets from public/
COPY --from=builder /app/public ./public

# Im Image eine unveränderliche Kopie der Seed-Assets aufheben, die der
# Startup-Symlink (public/uploads -> /data/assets) NICHT überdeckt. Beim
# Container-Start werden fehlende Dateien daraus ins Volume gespiegelt.
COPY --from=builder /app/public/uploads ./bundled-uploads

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Startup-Skript: Migration + Seed + Server
COPY --chown=nextjs:nodejs startup.js ./

# /data wird als Volume gemountet (gemeinsam mit PostgreSQL)
# PostgreSQL nutzt /data/pgdata, die App nutzt /data/assets
# /backups wird per Bind-Mount vom Host eingehängt (Backup-Sidecar + Restore)
RUN mkdir -p /data/assets /app/public/uploads /backups && \
    chown -R nextjs:nodejs /data /app/public/uploads /backups

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "startup.js"]
