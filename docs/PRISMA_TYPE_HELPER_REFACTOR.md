# Prisma Type Helper Refactoring

## Durum
Count denormalization işlemlerinden sonra Prisma type system'i bazı yeni count field'larını (`postsCount`, `trustCount`, `likesCount`, vb.) tanımıyor. Şu anda `as any` kullanılarak bu sorun geçici olarak çözüldü.

## Sorun
- `as any` kullanımı type safety'i kaybettiriyor
- Her yerde tekrar eden `as any` kullanımı maintainability'yi düşürüyor
- Hatalı field kullanımları compile-time'da yakalanmıyor

## Çözüm: Helper Type Functions

Type-safe ve maintainable bir çözüm için helper function'lar oluşturulmalı.

### Oluşturulacak Dosya
`src/infrastructure/repositories/prisma-types.helper.ts`

### İçerik

```typescript
import { Prisma } from '@prisma/client';

/**
 * Helper type for Profile updateMany operations
 * Used to safely type count field updates that Prisma types may not include
 */
export function asProfileUpdateMany(
  data: {
    postsCount?: { increment: number } | { decrement: number };
    trustCount?: { increment: number } | { decrement: number };
    trusterCount?: { increment: number } | { decrement: number };
    unseenFeedCount?: { increment: number } | { decrement: number };
  }
): Prisma.ProfileUpdateManyMutationInput {
  return data as unknown as Prisma.ProfileUpdateManyMutationInput;
}

/**
 * Helper type for ContentPost update operations
 */
export function asContentPostUpdate(
  data: {
    likesCount?: { increment: number } | { decrement: number };
    commentsCount?: { increment: number } | { decrement: number };
    favoritesCount?: { increment: number } | { decrement: number };
    viewsCount?: { increment: number } | { decrement: number };
  }
): Prisma.ContentPostUpdateInput {
  return data as unknown as Prisma.ContentPostUpdateInput;
}

/**
 * Helper type for ContentPost orderBy operations
 */
export function asContentPostOrderBy(
  data: {
    likesCount?: 'asc' | 'desc';
  }
): Prisma.ContentPostOrderByWithRelationInput {
  return data as unknown as Prisma.ContentPostOrderByWithRelationInput;
}

/**
 * Helper type for DMThread update operations
 */
export function asDMThreadUpdate(
  data: {
    unreadCountUserOne?: number | { increment: number };
    unreadCountUserTwo?: number | { increment: number };
  }
): Prisma.DMThreadUpdateInput {
  return data as unknown as Prisma.DMThreadUpdateInput;
}

/**
 * Helper type for Profile select operations
 */
export function asProfileSelect(
  fields: {
    unseenFeedCount?: boolean;
  }
): Prisma.ProfileSelect {
  return fields as unknown as Prisma.ProfileSelect;
}
```

### Kullanım Örnekleri

#### Önce (Mevcut)
```typescript
await this.prisma.profile.updateMany({
  where: { userId },
  data: {
    postsCount: { increment: 1 }
  } as any
});
```

#### Sonra (Helper ile)
```typescript
import { asProfileUpdateMany } from './prisma-types.helper';

await this.prisma.profile.updateMany({
  where: { userId },
  data: asProfileUpdateMany({
    postsCount: { increment: 1 }
  })
});
```

### Güncellenecek Dosyalar

1. `src/infrastructure/repositories/content-post-prisma.repository.ts`
   - `postsCount` updateMany işlemleri
   - `likesCount`, `commentsCount`, `favoritesCount`, `viewsCount` update işlemleri
   - `likesCount` orderBy işlemleri

2. `src/infrastructure/repositories/trust-relation-prisma.repository.ts`
   - `trustCount`, `trusterCount` updateMany işlemleri

3. `src/infrastructure/repositories/feed-prisma.repository.ts`
   - `unseenFeedCount` updateMany işlemleri
   - `unseenFeedCount` select işlemleri

4. `src/infrastructure/repositories/dm-message-prisma.repository.ts`
   - `unreadCountUserOne`, `unreadCountUserTwo` update işlemleri

5. `src/application/user/user.service.ts`
   - `trustCount`, `trusterCount` updateMany işlemleri

### Avantajlar

1. **Type Safety**: Hatalı field kullanımları compile-time'da yakalanır
2. **Maintainability**: Tüm tip dönüşümleri tek dosyada yönetilir
3. **Gelecekte Kolay Kaldırma**: Prisma tipleri düzeldiğinde helper'ları kaldırmak yeterli
4. **Okunabilirlik**: Kod daha anlaşılır hale gelir
5. **Refactoring**: Field adı değişirse tek yerden güncellenir

### Notlar

- Bu helper'lar Prisma'nın type system'inin güncellenmesini beklerken geçici bir çözümdür
- Prisma client generate edildiğinde ve type'lar düzeldiğinde bu helper'lar kaldırılabilir
- Helper function'lar runtime'da hiçbir overhead yaratmaz (sadece type assertion)

### İlgili İssue/PR
- Count denormalization implementation
- TypeScript type errors fix

### Son Güncelleme
2025-11-05

