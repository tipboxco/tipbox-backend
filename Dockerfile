FROM node:23.6.0-alpine

WORKDIR /app

# Package files ve Prisma schema'yı kopyala
COPY package*.json ./
COPY prisma ./prisma

# Dependencies'leri yükle
RUN npm install --legacy-peer-deps

# Prisma Client'ı generate et (schema kopyalandıktan sonra)
RUN npx prisma generate

# Source code'u kopyala
COPY . .

# Port'u expose et
EXPOSE 3000

# Development için nodemon ile başlat
CMD ["npm", "run", "dev"]
