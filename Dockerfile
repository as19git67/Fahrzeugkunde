# --- Stage 1: Dependencies ---
FROM node:24-bookworm-slim AS deps

# Build tools for better-sqlite3 native module (fallback if no prebuild available)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

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

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration script for DB init
COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrate.ts ./src/db/migrate.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/db/seed.ts ./src/db/seed.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/db/schema.ts ./src/db/schema.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Persistent directories (mount as volumes in production)
RUN mkdir -p /app/data /app/public/uploads && \
    chown -R nextjs:nodejs /app/data /app/public/uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
