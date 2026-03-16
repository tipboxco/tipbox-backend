FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Package files
COPY package.json pnpm-lock.yaml .npmrc ./

# Dependencies
RUN pnpm install

# Source
COPY . .

# Entrypoint script'ini kopyala ve çalıştırılabilir yap
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5174

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]
