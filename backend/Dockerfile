FROM node:23-alpine

WORKDIR /app

# node-gyp için Python ve build araçları (utf-8-validate, bufferutil gibi native modüller için)
RUN apk add --no-cache python3 make g++ && ln -sf /usr/bin/python3 /usr/bin/python

# pnpm kullan (monorepo ile uyumlu)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Package files, pnpm config ve Prisma schema'yi kopyala
COPY package.json .npmrc ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma

# Dependencies'leri yukle
RUN pnpm install --frozen-lockfile || pnpm install

# netcat kur (PostgreSQL port kontrolü için)
RUN apk add --no-cache netcat-openbsd

# Prisma Client'ı generate et (schema kopyalandıktan sonra)
# Not: prisma db push runtime'da çalıştırılacak (DATABASE_URL gerektirir)
RUN pnpm exec prisma generate

# Source code'u kopyala
COPY . .

# Entrypoint script'ini kopyala ve çalıştırılabilir yap
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Port'u expose et
EXPOSE 3000

# Entrypoint olarak script'i kullan
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Development için nodemon ile başlat
CMD ["pnpm", "run", "dev"]
