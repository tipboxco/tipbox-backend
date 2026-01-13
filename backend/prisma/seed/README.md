# Modular Seed Structure

This folder provides a modular seeding setup without changing the existing `prisma/seed.ts`.
You can keep using `npm run db:seed` as-is, or run the modular seeds explicitly.

## Files
- `types.ts`: Shared Prisma client, constants (IDs), and ULID helper
- `taxonomy.seed.ts`: Themes, categories, badge categories, metrics
- `user.seed.ts`: Users, profiles, avatars, titles, trust relations
- `content.seed.ts`: Minimal products and content posts (extend as needed)
- `feed.seed.ts`: Minimal feed/trending entries
- `marketplace.seed.ts`: Minimal marketplace banners (extend as needed)
- `explore.seed.ts`: Minimal brands and wishbox data
- `index.ts`: Orchestrates all seeds

## Usage
- Keep using legacy seed:
  ```bash
  npx ts-node prisma/seed.ts
  ```
- Or run the modular seeds:
  ```bash
  npx ts-node prisma/seed/index.ts
  ```

## Migration Path
1) Gradually move blocks from `prisma/seed.ts` into the corresponding `*.seed.ts` files.
2) Replace direct logic with function calls in `index.ts`.
3) When complete, update your package.json seed script to `ts-node prisma/seed/index.ts`.

> Note: The modular seeds include minimal, idempotent inserts to avoid heavy duplication with the original seed. Extend them with full logic as you migrate.



