import { PrismaClient } from '@prisma/client';
import { createPrismaWithIdMiddleware } from './prisma-id-middleware';

let prismaSingleton: ReturnType<typeof createPrismaWithIdMiddleware> | null = null;

export function getPrisma(): ReturnType<typeof createPrismaWithIdMiddleware> {
  if (!prismaSingleton) {
    prismaSingleton = createPrismaWithIdMiddleware();
  }
  return prismaSingleton;
}


