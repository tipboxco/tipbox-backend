import { PrismaClient } from '@prisma/client';
import { createPrismaWithIdMiddleware } from './prisma-id-middleware';

// Global object için type tanımı (hot reload desteği için)
const globalForPrisma = global as unknown as {
  prisma: ReturnType<typeof createPrismaWithIdMiddleware> | undefined;
};

/**
 * Prisma Client singleton instance'ını döner
 * Hot reload sırasında instance'ın korunması için global object kullanır
 * 
 * @returns Prisma Client instance (ID middleware ile birlikte)
 */
export function getPrisma(): ReturnType<typeof createPrismaWithIdMiddleware> {
  // Development ortamında global object'ten al (hot reload için)
  if (process.env.NODE_ENV !== 'production') {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaWithIdMiddleware();
    }
    return globalForPrisma.prisma;
  }

  // Production ortamında module-level singleton kullan
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaWithIdMiddleware();
  }
  return globalForPrisma.prisma;
}

/**
 * Prisma Client'ı temizler (test ve shutdown için)
 * Dikkat: Bu fonksiyon sadece test ortamında veya graceful shutdown sırasında kullanılmalıdır
 */
export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}


