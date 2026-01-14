# Development Dockerfile for Medusa
FROM node:20-alpine

# Set working directory
WORKDIR /server

# Copy package files and npm config
COPY package.json package-lock.json ./

# Install unzip for extracting ZIP files
RUN apk add --no-cache unzip

# Install all dependencies using npm
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose the port Medusa runs on
EXPOSE 9000

# Start with migrations and then the development server
CMD ["sh", "-c", "[ -f src/scripts/tipbox-datas/products_with_images.zip ] && unzip -o src/scripts/tipbox-datas/products_with_images.zip -d src/scripts/tipbox-datas/ || true && echo 'Running database migrations...' && npx medusa db:migrate && echo 'Creating root user...' && npx medusa user --email root@tipbox.co --password root@tipbox.co || true && echo 'Starting Medusa server...' && npm run start"]