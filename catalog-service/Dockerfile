# syntax=docker/dockerfile:1
# Development Dockerfile for Medusa - BuildKit optimized
FROM node:20-alpine

# Install dos2unix, postgresql-client and unzip
RUN apk add --no-cache dos2unix postgresql-client unzip

# pnpm aktif et
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Set working directory
WORKDIR /server

# 1) Sadece dependency dosyalarini kopyala (layer cache icin)
COPY package.json ./
COPY pnpm-lock.yaml* ./

# 2) Dependencies'leri yukle (BuildKit cache mount ile pnpm store cache'lenir)
RUN --mount=type=cache,id=pnpm-store-catalog,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

# 3) Source code'u kopyala
COPY . .

# Fix Windows CRLF line endings and make executable
RUN dos2unix start.sh && chmod +x start.sh

# Expose the port Medusa runs on
EXPOSE 9000

# Start with migrations and then the development server
CMD ["sh", "-c", "dos2unix /server/start.sh 2>/dev/null || true; sh /server/start.sh"]
