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
RUN mkdir -p /data/assets /app/public/uploads && \
    chown -R nextjs:nodejs /data /app/public/uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "startup.js"]
