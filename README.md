# Tipbox Backend

Bu repo, Tipbox uygulamasının Node.js, Express ve TypeScript ile yazılmış backend API'sini içerir. Mimari olarak Domain-Driven Design (DDD) ve Modular Monolith yaklaşımı benimsenmiştir.

## Başlangıç

### Gereksinimler
- Node.js (18+ önerilir)
- PostgreSQL

### Kurulum

```bash
npm install
cp .env.example .env
# .env dosyasını doldurun
npx prisma migrate dev --name init
npm run dev
```

### Scriptler
- `npm run dev` — Geliştirme sunucusu (nodemon ile)
- `npm run build` — TypeScript derlemesi
- `npm run start` — Derlenmiş kodu başlatır
- `npm run lint` — ESLint ile kodu kontrol eder
- `npm run format` — Prettier ile kodu formatlar

## Dizin Yapısı

```
src/
  domain/
  application/
  infrastructure/
  interfaces/
```

## Katkı

PR'lar ve katkılar memnuniyetle karşılanır!
