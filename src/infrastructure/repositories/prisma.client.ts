import { PrismaClient } from '@prisma/client';
import { registerIdMiddleware } from './prisma-id-middleware';

let prismaSingleton: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
    registerIdMiddleware(prismaSingleton);
  }
  return prismaSingleton;
}


