# Development Dockerfile for Medusa
FROM node:20-alpine

# Install dos2unix, postgresql-client and unzip
RUN apk add --no-cache dos2unix postgresql-client unzip

# Set working directory
WORKDIR /server

# Copy package files and npm config
COPY package.json  ./

# Install all dependencies using npm
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Fix Windows CRLF line endings and make executable
RUN dos2unix start.sh && chmod +x start.sh

# Expose the port Medusa runs on
EXPOSE 9000

# Start with migrations and then the development server
# Using sh -c to handle potential CRLF issues from volume mount
CMD ["sh", "-c", "dos2unix /server/start.sh 2>/dev/null || true; sh /server/start.sh"]