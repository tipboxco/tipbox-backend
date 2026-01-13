import { v4 as uuidv4 } from 'uuid';
import { ulid } from 'ulid';

export type IdFormat = 'ULID' | 'UUID4';

// Modeller bazında ID formatı stratejisi
// Bu isimler Prisma model isimleri ile eşleşmelidir
export const modelIdStrategy: Record<string, IdFormat> = {
  // ULID kullanacaklar
  ContentPost: 'ULID',
  ContentComment: 'ULID',
  Feed: 'ULID',
  FeedHighlight: 'ULID',
  TrendingPost: 'ULID',
  BridgePost: 'ULID',
  WishboxEvent: 'ULID',
  // Varsayılanlar (diğerleri UUID4)
};

export function generateUlid(): string {
  return ulid();
}

export function generateUuidV4(): string {
  return uuidv4();
}

export function generateIdForModel(modelName: string): string {
  const strategy = modelIdStrategy[modelName] || 'UUID4';
  return strategy === 'ULID' ? generateUlid() : generateUuidV4();
}


