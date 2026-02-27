FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Package files
COPY package.json ./

# Dependencies
RUN pnpm install

# Source
COPY . .

EXPOSE 5174

# Vite dev server (host 0.0.0.0 via config)
CMD ["pnpm", "run", "dev"]
