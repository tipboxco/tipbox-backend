# ══════════════════════════════════════════════════════════════════
# Multi-stage Dockerfile
#   dev   → bind mount + named volume kullanır, build hızlı (~5s)
#   full  → deps + source baked-in (CI veya standalone kullanım)
# ══════════════════════════════════════════════════════════════════

# ── Stage: base ──────────────────────────────────────────────────
# System deps + pnpm. Nadiren değişir → haftalarca cache'de kalır.
FROM node:23-alpine AS base

WORKDIR /app

# python3/make/g++ → native modüller (utf-8-validate, bufferutil)
RUN apk add --no-cache python3 make g++ netcat-openbsd \
    && ln -sf /usr/bin/python3 /usr/bin/python

# pnpm aktif et
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# pnpm store path'i /app içine sabitle (root'a yazma hatasını önler)
ENV PNPM_HOME=/app/.pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /app/.pnpm-store

# Entrypoint her stage'de lazım
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]

# ── Stage: dev ───────────────────────────────────────────────────
# Dev/test compose'da kullanılır.
# Bind mount → source code, named volume → node_modules sağlar.
# Entrypoint pnpm install + prisma generate'i runtime'da halleder.
# Build süresi: ~5 saniye (cache hit) — deps yüklenmez, source kopyalanmaz.
FROM base AS dev
# Hiçbir şey eklemeye gerek yok — base yeterli.

# ── Stage: full ──────────────────────────────────────────────────
# Deps + source image'a baked-in. Standalone çalışır (bind mount gerektirmez).
FROM base AS full

# 1) Dependency dosyaları (layer cache için ayrı)
COPY package.json .npmrc ./
COPY pnpm-lock.yaml* ./

# 2) Prisma schema (postinstall prisma generate çalıştırır)
COPY prisma ./prisma

# 3) Dependencies — BuildKit cache mount ile pnpm store kalıcı
RUN --mount=type=cache,id=tipbox-pnpm-store,target=/app/.pnpm-store \
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 4) Source code (en sık değişen layer en sona)
COPY . .
