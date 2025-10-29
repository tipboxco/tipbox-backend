FROM node:18-alpine

WORKDIR /app

# Package files'ları kopyala
COPY package*.json ./

# Dependencies'leri yükle
RUN npm install

# Prisma'yı global olarak yükle (opsiyonel ama yararlı)
RUN npx prisma generate || echo "Prisma generate skipped if schema not available yet"

# Source code'u kopyala
COPY . .

# Prisma Client'ı tekrar generate et (schema kopyalandıktan sonra)
RUN npx prisma generate

# Port'u expose et
EXPOSE 3000

# Development için nodemon ile başlat
CMD ["npm", "run", "dev"]
