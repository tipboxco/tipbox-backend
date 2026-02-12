FROM node:20-alpine

WORKDIR /app

# Package files
COPY package*.json ./

# Dependencies
RUN npm ci

# Source
COPY . .

EXPOSE 5174

# Vite dev server (host 0.0.0.0 via config)
CMD ["npm", "run", "dev"]
