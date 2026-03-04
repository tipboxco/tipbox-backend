# syntax=docker/dockerfile:1
FROM node:23-alpine

WORKDIR /app

# python3/make/g++ → native modüller (utf-8-validate, bufferutil)
RUN apk add --no-cache python3 make g++ \
    && ln -sf /usr/bin/python3 /usr/bin/python

# pnpm aktif et
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 1) Sadece dependency dosyalarını kopyala (layer cache için)
COPY package.json .npmrc ./
COPY pnpm-lock.yaml* ./

# 2) Prisma schema'yı kopyala (install öncesi - postinstall prisma generate çalıştırır)
COPY prisma ./prisma

# 3) Dependencies'leri yükle (BuildKit cache mount ile pnpm store cache'lenir)
#    postinstall script'i prisma generate'ı otomatik çalıştırır
RUN --mount=type=cache,id=pnpm-store-backend,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

# 4) Source code'u kopyala (en sık değişen layer en sona)
COPY . .

# Entrypoint script'ini kopyala ve çalıştırılabilir yap
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]
