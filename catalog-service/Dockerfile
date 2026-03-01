# Development Dockerfile for Medusa
FROM node:20-alpine

# Install dos2unix, postgresql-client and unzip
RUN apk add --no-cache dos2unix postgresql-client unzip

# pnpm (start.sh pnpm run dev kullanıyor)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Set working directory
WORKDIR /server

# Copy package files
COPY package.json  ./

# Install all dependencies
RUN pnpm install

# Copy source code
COPY . .

# Fix Windows CRLF line endings and make executable
RUN dos2unix start.sh && chmod +x start.sh

# Expose the port Medusa runs on
EXPOSE 5175

# Start with migrations and then the development server
# Using sh -c to handle potential CRLF issues from volume mount
CMD ["sh", "-c", "dos2unix /server/start.sh 2>/dev/null || true; sh /server/start.sh"]