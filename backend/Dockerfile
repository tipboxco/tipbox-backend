# ══════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile
#   dev   → deps build'de yüklenir, /app-deps'e taşınır
#           runtime'da entrypoint volume'a kopyalar (pnpm install ÇALIŞMAZ)
#   full  → deps + source baked-in (standalone kullanım)
# ══════════════════════════════════════════════════════════════════

# ── Stage: base ──────────────────────────────────────────────────
FROM node:23-alpine AS base

WORKDIR /app

# python3/make/g++ → native modüller (utf-8-validate, bufferutil)
RUN apk add --no-cache python3 make g++ netcat-openbsd \
    && ln -sf /usr/bin/python3 /usr/bin/python

# pnpm aktif et
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ENV PNPM_HOME=/app/.pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /app/.pnpm-store

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]

# ── Stage: dev ───────────────────────────────────────────────────
FROM base AS dev

# Dependency dosyaları
COPY package.json .npmrc ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma

# Dependencies — BuildKit cache mount ile pnpm store kalıcı
RUN --mount=type=cache,id=tipbox-pnpm-store,target=/app/.pnpm-store \
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Lock checksum'ı yaz + deps'i staging path'e taşı
# /app-deps bind mount'tan etkilenmez — entrypoint buradan volume'a kopyalar
RUN md5sum pnpm-lock.yaml | cut -d' ' -f1 > node_modules/.lock-checksum \
    && mv node_modules /app-deps

# ── Stage: full ──────────────────────────────────────────────────
FROM base AS full

COPY package.json .npmrc ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma

RUN --mount=type=cache,id=tipbox-pnpm-store,target=/app/.pnpm-store \
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY . .
