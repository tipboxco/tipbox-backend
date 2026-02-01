FROM node:20-alpine

WORKDIR /app

# node-gyp için Python ve build araçları (utf-8-validate, bufferutil gibi native modüller için)
RUN apk add --no-cache python3 make g++ && ln -sf /usr/bin/python3 /usr/bin/python

# Package files ve Prisma schema'yı kopyala
COPY package*.json ./
COPY prisma ./prisma

# Dependencies'leri yükle (cache friendly)
# npm ci package-lock.json varsa kullanır (daha hızlı ve güvenilir)
# Yoksa npm install'a fallback yapar
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps --no-optional

# Docker CLI ve netcat kur (docker ps ve PostgreSQL port kontrolü için)
RUN apk add --no-cache docker-cli netcat-openbsd

# Prisma Client'ı generate et (schema kopyalandıktan sonra)
# Not: prisma db push runtime'da çalıştırılacak (DATABASE_URL gerektirir)
RUN npx prisma generate

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
CMD ["npm", "run", "dev"]
