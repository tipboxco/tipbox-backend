import CacheService from '../cache/cache.service';
import { CACHE_KEYS } from '../cache/cache-keys';
import { CACHE_TTL } from '../cache/cache-ttl';
import logger from '../logger/logger';
import { verifyJwt } from './jwt.helper';

const cacheService = CacheService.getInstance();

// In-memory fallback: Redis çalışmadığında bile yakın zamanda blacklist'e eklenen token'ları hatırla
const MEMORY_BLACKLIST_MAX_SIZE = 10_000;
const memoryBlacklist = new Map<string, number>(); // token → expiry timestamp (ms)

function addToMemoryBlacklist(token: string, ttlSeconds: number): void {
  // Expired entry'leri temizle (lazy cleanup)
  if (memoryBlacklist.size >= MEMORY_BLACKLIST_MAX_SIZE) {
    const now = Date.now();
    for (const [key, expiry] of memoryBlacklist) {
      if (expiry <= now) memoryBlacklist.delete(key);
    }
    // Hala doluysa en eski entry'leri sil
    if (memoryBlacklist.size >= MEMORY_BLACKLIST_MAX_SIZE) {
      const keysToDelete = Array.from(memoryBlacklist.keys()).slice(0, 1000);
      for (const key of keysToDelete) memoryBlacklist.delete(key);
    }
  }
  memoryBlacklist.set(token, Date.now() + ttlSeconds * 1000);
}

function isInMemoryBlacklist(token: string): boolean {
  const expiry = memoryBlacklist.get(token);
  if (expiry === undefined) return false;
  if (expiry <= Date.now()) {
    memoryBlacklist.delete(token);
    return false;
  }
  return true;
}

/**
 * Token'ı blacklist'e ekler
 * @param token - Blacklist'e eklenecek JWT token
 * @param expiresIn - Token'ın expire süresine kadar cache'de tutulacak (saniye)
 */
export async function blacklistToken(token: string, expiresIn?: number): Promise<void> {
  try {
    // Token'dan expire süresini al
    let ttl = expiresIn;
    
    if (!ttl) {
      const payload = verifyJwt(token);
      if (payload && payload.exp) {
        // exp unix timestamp (saniye) olarak geliyor
        const now = Math.floor(Date.now() / 1000);
        ttl = payload.exp - now;
        
        // Token zaten expired ise blacklist'e eklemeye gerek yok
        if (ttl <= 0) {
          logger.debug('Token already expired, not adding to blacklist', { token: token.substring(0, 20) });
          return;
        }
      } else {
        // Expire süresi bulunamadıysa default 7 gün
        ttl = CACHE_TTL.TOKEN_BLACKLIST;
      }
    }
    
    // Memory fallback'e de ekle (Redis çökerse token hala reddedilsin)
    addToMemoryBlacklist(token, ttl);

    const key = CACHE_KEYS.TOKEN_BLACKLIST(token);
    await cacheService.set(key, '1', ttl);

    logger.info('Token blacklisted', {
      tokenPrefix: token.substring(0, 20),
      ttl
    });
  } catch (error) {
    logger.error('Failed to blacklist token', { error });
    // Redis hata verse bile memory fallback'e eklendi, güvenli taraftayız
  }
}

/**
 * Token'ın blacklist'te olup olmadığını kontrol eder
 * @param token - Kontrol edilecek JWT token
 * @returns Token blacklist'te ise true, değilse false
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const key = CACHE_KEYS.TOKEN_BLACKLIST(token);
    const result = await cacheService.get(key);
    return result !== null;
  } catch (error) {
    logger.error('Failed to check token blacklist via Redis, falling back to memory', { error });
    // Redis çalışmıyorsa in-memory fallback'i kontrol et (fail-secure)
    return isInMemoryBlacklist(token);
  }
}

/**
 * Kullanıcının tüm token'larını blacklist'e ekler (logout all devices)
 * @param userId - Kullanıcı ID
 * @param tokens - Kullanıcının tüm aktif token'ları
 */
export async function blacklistAllUserTokens(userId: string, tokens: string[]): Promise<void> {
  try {
    const promises = tokens.map(token => blacklistToken(token));
    await Promise.all(promises);
    
    logger.info('All user tokens blacklisted', { 
      userId, 
      tokenCount: tokens.length 
    });
  } catch (error) {
    logger.error('Failed to blacklist all user tokens', { error, userId });
  }
}

/**
 * Blacklist'teki token sayısını döndürür (monitoring için)
 * NOT: Redis SCAN kullanarak token sayısını bulamaz, pattern matching ile yapılabilir
 */
export async function getBlacklistCount(): Promise<number | null> {
  try {
    // Bu fonksiyon performans sorunlarına neden olabilir
    // Production'da kullanılmamalı, sadece monitoring/debug için
    logger.warn('getBlacklistCount called - this operation is expensive');
    
    // Pattern ile blacklist key'lerini bul
    // NOT: Bu operation production'da kullanılmamalı
    return null; // Şimdilik implement etmiyoruz
  } catch (error) {
    logger.error('Failed to get blacklist count', { error });
    return null;
  }
}

export default {
  blacklistToken,
  isTokenBlacklisted,
  blacklistAllUserTokens,
  getBlacklistCount,
};

