import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
export const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';

export const TRUST_USER_IDS: string[] = [
  '11111111-1111-4111-a111-111111111111',
  '22222222-2222-4222-a222-222222222222',
  '33333333-3333-4333-a333-333333333333',
  '44444444-4444-4444-a444-444444444444',
  '55555555-5555-4555-a555-555555555555',
];

export const TRUSTER_USER_IDS: string[] = [
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-cccc-cccccccccccc',
];

export const DEFAULT_PASSWORD = 'password123';

export function generateUlid(): string {
  const timestamp = Date.now().toString(36).toUpperCase().padStart(10, '0');
  const randomPart = Math.random().toString(36).substring(2, 18).toUpperCase().padStart(16, '0');
  return (timestamp + randomPart).substring(0, 26);
}

export type SeedResult<T extends Record<string, unknown> = Record<string, unknown>> = T;



