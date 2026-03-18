/**
 * Jest E2E Test Setup
 *
 * Bu dosya jest.config.test.ts tarafından setupFilesAfterSetup olarak yüklenir.
 * Prisma client'ı initialize eder ve testler bittikten sonra kapatır.
 */

import { getPrisma, disconnectPrisma } from '../src/infrastructure/repositories/prisma.client';

// Test ortamı env override'ları
process.env.NODE_ENV = 'test';
process.env.TIP_SEND_QUEUE_DELAY_MS = '0'; // Queue delay'i sıfırla

beforeAll(async () => {
  // Prisma bağlantısını kontrol et
  const prisma = getPrisma();
  await prisma.$connect();
});

afterAll(async () => {
  await disconnectPrisma();
});
