# syntax=docker/dockerfile:1
# ══════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile for Medusa (Catalog Service)
#   dev   → deps /deps/ altında build edilir
#   full  → deps + source baked-in
# ══════════════════════════════════════════════════════════════════

# ── Stage: base ──────────────────────────────────────────────────
FROM node:20-alpine AS base

RUN apk add --no-cache dos2unix postgresql-client unzip

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /server

COPY start.sh ./
RUN dos2unix start.sh && chmod +x start.sh

EXPOSE 9000

CMD ["sh", "-c", "sh /server/start.sh"]

# ── Stage: dev ───────────────────────────────────────────────────
FROM base AS dev

WORKDIR /deps
COPY .npmrc package.json pnpm-lock.yaml* ./

RUN --mount=type=cache,id=pnpm-store-catalog,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install \
    && md5sum pnpm-lock.yaml | cut -d' ' -f1 > node_modules/.lock-checksum

WORKDIR /server

# ── Stage: full ──────────────────────────────────────────────────
FROM base AS full

COPY .npmrc package.json pnpm-lock.yaml* ./

RUN --mount=type=cache,id=pnpm-store-catalog,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

COPY . .
RUN dos2unix start.sh && chmod +x start.sh
