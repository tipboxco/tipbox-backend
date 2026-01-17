# Tipbox Backend

This repository contains the backend API for the Tipbox application, built with Node.js, Express, and TypeScript. The architecture follows Domain-Driven Design (DDD) and Modular Monolith principles.

## Getting Started

### Quick Start (Docker - Önerilen)

```bash
# 1. Container'ları başlat
docker-compose up -d

# 2. Veritabanı şemasını uygula
docker-compose exec backend npx prisma db push

# 3. Seed data'yı yükle
docker-compose exec backend npm run db:seed

# 4. Prisma Studio'yu başlat (opsiyonel)
docker-compose exec backend npx prisma studio --port 5555
```

Detaylı kurulum rehberi için: [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)

### Manual Installation

#### Requirements
- Node.js (18+ recommended)
- PostgreSQL
- Redis

#### Installation

```bash
npm install
cp .env.example .env
# Fill in the .env file
npx prisma db push
npx prisma generate
npm run db:seed
npm run dev
```

### Scripts
- `npm run dev` — Development server (with nodemon)
- `npm run build` — TypeScript build
- `npm run start` — Runs the compiled code
- `npm run db:seed` — Load seed data to database
- `npm run db:studio` — Start Prisma Studio
- `npm run lint` — Checks code with ESLint
- `npm run format` — Formats code with Prettier

## Directory Structure

```
src/
  domain/
  application/
  infrastructure/
  interfaces/
```

## Test Credentials

After running seed, you can use these test accounts:

- **Email:** `omer@tipbox.co`
- **Password:** `password123`

For more test accounts, see [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)

## Documentation

- [Setup Guide](docs/SETUP_GUIDE.md) - Detailed setup instructions
- [Session Summary](docs/SESSION_SUMMARY.md) - Recent changes and fixes

## Contribution

Pull requests and contributions are welcome!
