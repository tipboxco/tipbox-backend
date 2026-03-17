# ══════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile
#   dev   → deps /deps/ altında build edilir
#   full  → deps + source baked-in
# ══════════════════════════════════════════════════════════════════

# ── Stage: base ──────────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5174

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]

# ── Stage: dev ───────────────────────────────────────────────────
FROM base AS dev

WORKDIR /deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install \
    && md5sum pnpm-lock.yaml | cut -d' ' -f1 > node_modules/.lock-checksum

WORKDIR /app

# ── Stage: full ──────────────────────────────────────────────────
FROM base AS full

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install

COPY . .
