import { Prisma } from '@prisma/client';
import { getPrisma } from '../repositories/prisma.client';
import logger from '../logger/logger';

const prisma = getPrisma();

export interface TransactionOptions {
  /**
   * Transaction timeout süresi (milisaniye)
   * @default 10000 (10 saniye)
   */
  timeout?: number;
  
  /**
   * Transaction kuyruğunda bekleme süresi (milisaniye)
   * @default 5000 (5 saniye)
   */
  maxWait?: number;
  
  /**
   * Isolation level
   * @default 'ReadCommitted'
   */
  isolationLevel?: Prisma.TransactionIsolationLevel;
  
  /**
   * Maksimum retry sayısı (deadlock durumunda)
   * @default 3
   */
  maxRetries?: number;
  
  /**
   * Retry delay multiplier (exponential backoff)
   * @default 100 (ilk retry 100ms, ikinci 200ms, üçüncü 400ms)
   */
  retryDelayMs?: number;
}

/**
 * Prisma transaction wrapper with timeout and retry mechanism
 * 
 * @param fn - Transaction içinde çalışacak fonksiyon
 * @param options - Transaction konfigürasyonu
 * @returns Transaction sonucu
 * 
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   const user = await tx.user.create({ data: { email: 'test@test.com' } });
 *   const profile = await tx.profile.create({ data: { userId: user.id } });
 *   return { user, profile };
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    timeout = 10000,
    maxWait = 5000,
    isolationLevel = 'ReadCommitted',
    maxRetries = 3,
    retryDelayMs = 100,
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await prisma.$transaction(
        fn,
        {
          timeout,
          maxWait,
          isolationLevel,
        }
      );
      
      // Success - reset error count if any
      if (attempt > 0) {
        logger.info('Transaction succeeded after retry', { attempt });
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Prisma error codes
      const isDeadlock = error.code === 'P2034';
      const isTimeout = error.code === 'P2024';
      const isConnectionError = error.code === 'P1001' || error.code === 'P1002';
      
      // Retry edilebilir hatalar
      const isRetriable = isDeadlock || isTimeout || isConnectionError;
      
      if (isRetriable && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * retryDelayMs;
        
        logger.warn('Transaction failed, retrying', {
          attempt: attempt + 1,
          maxRetries,
          errorCode: error.code,
          errorMessage: error.message,
          delayMs: delay,
        });
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Retry edilemez hata veya max retry aşıldı
      logger.error('Transaction failed after all retries', {
        attempts: attempt + 1,
        errorCode: error.code,
        errorMessage: error.message,
        stack: error.stack,
      });
      
      throw error;
    }
  }
  
  // Bu noktaya gelmemeli ama TypeScript için
  throw lastError || new Error('Transaction failed after all retries');
}

/**
 * Nested transaction helper - Prisma nested transaction'ları desteklemez,
 * bu yüzden nested transaction yerine mevcut transaction'ı kullan
 * 
 * @param tx - Mevcut transaction client (varsa)
 * @param fn - Çalıştırılacak fonksiyon
 * @returns Fonksiyon sonucu
 * 
 * @example
 * ```typescript
 * async function createUserWithProfile(tx?: Prisma.TransactionClient) {
 *   return await withOptionalTransaction(tx, async (txClient) => {
 *     const user = await txClient.user.create({ ... });
 *     const profile = await txClient.profile.create({ ... });
 *     return { user, profile };
 *   });
 * }
 * 
 * // Transaction içinden çağır
 * await withTransaction(async (tx) => {
 *   await createUserWithProfile(tx);
 * });
 * 
 * // Direkt çağır (kendi transaction'ını oluşturur)
 * await createUserWithProfile();
 * ```
 */
export async function withOptionalTransaction<T>(
  tx: Prisma.TransactionClient | undefined,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  if (tx) {
    // Mevcut transaction'ı kullan
    return fn(tx);
  }
  
  // Yeni transaction oluştur
  return withTransaction(fn, options);
}

/**
 * Transaction içinde batch operation helper
 * Büyük batch'leri chunk'lara böler ve transaction içinde işler
 * 
 * @param items - İşlenecek item'lar
 * @param batchSize - Her batch'teki item sayısı
 * @param fn - Her item için çalışacak fonksiyon
 * @param options - Transaction options
 * @returns İşlenen item sonuçları
 * 
 * @example
 * ```typescript
 * const results = await batchInTransaction(
 *   userIds,
 *   100,
 *   async (tx, userId) => {
 *     return await tx.user.update({
 *       where: { id: userId },
 *       data: { verified: true }
 *     });
 *   }
 * );
 * ```
 */
export async function batchInTransaction<T, R>(
  items: T[],
  batchSize: number,
  fn: (tx: Prisma.TransactionClient, item: T) => Promise<R>,
  options?: TransactionOptions
): Promise<R[]> {
  const results: R[] = [];
  
  // Chunk'lara böl
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    
    // Her chunk için transaction
    const chunkResults = await withTransaction(async (tx) => {
      const promises = chunk.map(item => fn(tx, item));
      return Promise.all(promises);
    }, options);
    
    results.push(...chunkResults);
    
    logger.debug('Batch transaction completed', {
      processed: i + chunk.length,
      total: items.length,
    });
  }
  
  return results;
}

/**
 * Read-only transaction helper (daha hızlı, lock almaz)
 * 
 * @param fn - Transaction içinde çalışacak fonksiyon
 * @returns Transaction sonucu
 */
export async function withReadOnlyTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return withTransaction(fn, {
    isolationLevel: 'ReadUncommitted', // En hızlı, dirty read yapabilir
    timeout: 5000, // Read için daha kısa timeout
    maxWait: 2000,
  });
}

export default {
  withTransaction,
  withOptionalTransaction,
  batchInTransaction,
  withReadOnlyTransaction,
};

