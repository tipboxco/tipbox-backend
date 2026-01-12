FROM node:20-alpine

WORKDIR /app

# Package files ve Prisma schema'yı kopyala
COPY package*.json ./
COPY prisma ./prisma

# Dependencies'leri yükle (cache friendly)
# npm ci package-lock.json varsa kullanır (daha hızlı ve güvenilir)
# Yoksa npm install'a fallback yapar
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps --no-optional

# Docker CLI kur (docker ps için)
RUN apk add --no-cache docker-cli

# Prisma Client'ı generate et (schema kopyalandıktan sonra)
RUN npx prisma generate

# Source code'u kopyala
COPY . .

# Port'u expose et
EXPOSE 3000

# Development için nodemon ile başlat
CMD ["npm", "run", "dev"]
