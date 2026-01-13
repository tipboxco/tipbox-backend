import CacheService from '../cache/cache.service';
import { CACHE_KEYS } from '../cache/cache-keys';
import { CACHE_TTL } from '../cache/cache-ttl';
import logger from '../logger/logger';
import { verifyJwt } from './jwt.helper';

const cacheService = CacheService.getInstance();

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
    
    const key = CACHE_KEYS.TOKEN_BLACKLIST(token);
    await cacheService.set(key, '1', ttl);
    
    logger.info('Token blacklisted', { 
      tokenPrefix: token.substring(0, 20),
      ttl 
    });
  } catch (error) {
    logger.error('Failed to blacklist token', { error });
    // Hata durumunda throw etme, graceful degradation
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
    logger.error('Failed to check token blacklist', { error });
    // Hata durumunda güvenli tarafta kal - token'ı geçerli say
    // Cache çalışmıyorsa tüm kullanıcıları logout etmek istemeyiz
    return false;
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

