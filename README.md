# Tipbox Backend

This repository contains the backend API for the Tipbox application, built with Node.js, Express, and TypeScript. The architecture follows Domain-Driven Design (DDD) and Modular Monolith principles.

## Getting Started

### Requirements
- Node.js (18+ recommended)
- PostgreSQL

### Installation

```bash
npm install
cp .env.example .env
# Fill in the .env file
npx prisma migrate dev --name init
npm run dev
```

### Scripts
- `npm run dev` — Development server (with nodemon)
- `npm run build` — TypeScript build
- `npm run start` — Runs the compiled code
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

## Contribution

Pull requests and contributions are welcome!
