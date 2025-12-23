import { createClient, RedisClientType } from 'redis';
import logger from '../logger/logger';
import { markCacheStatus } from '../middleware/request-context.middleware';

// CACHE_ENABLED === 'false' ise cache tamamen devre dışı
const isCacheDisabled = process.env.CACHE_ENABLED === 'false';

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // 5 hata sonrası circuit breaker aktif
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 60 saniye sonra tekrar dene
const OPERATION_TIMEOUT = 5000; // 5 saniye operation timeout

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType | null = null;
  private isConnected = false;
  private errorCount = 0;
  private circuitBreakerOpenUntil: number | null = null;

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Redis client bağlantısını kurar
   */
  public async connect(): Promise<void> {
    if (isCacheDisabled) {
      logger.info('Cache disabled by CACHE_ENABLED=false, skipping Redis connection');
      return;
    }

    if (this.isConnected && this.client) {
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({ 
        url: redisUrl,
        socket: {
          connectTimeout: 10000, // 10 seconds
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis cache reconnection failed after 10 retries');
              return new Error('Redis reconnection limit exceeded');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });
      
      this.client.on('error', (err) => {
        logger.error('Redis Cache Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Cache Client connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.info('Redis Cache Client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info('Cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cache service:', error);
      throw error;
    }
  }

  /**
   * Circuit breaker kontrolü
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerOpenUntil === null) {
      return false;
    }
    
    if (Date.now() < this.circuitBreakerOpenUntil) {
      return true;
    }
    
    // Timeout geçti, circuit breaker'ı resetle
    this.circuitBreakerOpenUntil = null;
    this.errorCount = 0;
    logger.info('Circuit breaker reset, attempting to reconnect cache');
    return false;
  }

  /**
   * Hata kaydı ve circuit breaker aktivasyonu
   */
  private recordError(): void {
    this.errorCount++;
    if (this.errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
      logger.warn(`Circuit breaker activated for ${CIRCUIT_BREAKER_TIMEOUT}ms due to ${this.errorCount} consecutive errors`);
    }
  }

  /**
   * Başarılı operasyon kaydı
   */
  private recordSuccess(): void {
    this.errorCount = 0;
  }

  /**
   * Timeout ile cache operasyonu
   */
  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number = OPERATION_TIMEOUT): Promise<T> {
    return Promise.race([
      operation,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Cache operation timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Redis'ten veri alır ve JSON.parse ile objeye çevirir
   * @param key - Cache anahtarı
   * @returns Parsed data veya null
   */
  public async get<T>(key: string): Promise<T | null> {
    if (isCacheDisabled) {
      return null;
    }

    if (this.isCircuitBreakerOpen()) {
      logger.debug('Circuit breaker open, skipping cache get');
      return null;
    }

    if (!this.client || !this.isConnected) {
      logger.warn('Cache client not connected, skipping cache get');
      return null;
    }

    try {
      const value = await this.withTimeout(this.client.get(key));
      if (value === null) {
        // Cache miss - otomatik olarak işaretle
        markCacheStatus('miss');
        return null;
      }
      const parsed = JSON.parse(value) as T;
      this.recordSuccess();
      
      // Cache hit - otomatik olarak işaretle
      markCacheStatus('hit');
      
      return parsed;
    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error);
      this.recordError();
      
      // Cache error - bypass olarak işaretle
      markCacheStatus('bypass');
      
      return null;
    }
  }

  /**
   * Veriyi JSON.stringify ile string'e çevirir ve Redis'e kaydeder
   * @param key - Cache anahtarı
   * @param value - Kaydedilecek veri
   * @param ttlInSeconds - Time to live (saniye), varsayılan 3600 (1 saat)
   */
  public async set(key: string, value: any, ttlInSeconds: number = 3600): Promise<void> {
    if (isCacheDisabled) {
      return;
    }

    if (this.isCircuitBreakerOpen()) {
      logger.debug('Circuit breaker open, skipping cache set');
      return;
    }

    if (!this.client || !this.isConnected) {
      logger.warn('Cache client not connected, skipping cache set');
      return;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await this.withTimeout(this.client.setEx(key, ttlInSeconds, serializedValue));
      logger.debug(`Cache set for key: ${key}, TTL: ${ttlInSeconds}s`);
      this.recordSuccess();
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error);
      this.recordError();
    }
  }

  /**
   * Belirtilen anahtarı ve verisini cache'ten siler
   * @param key - Silinecek cache anahtarı
   */
  public async del(key: string): Promise<void> {
    if (isCacheDisabled) {
      return;
    }

    if (!this.client || !this.isConnected) {
      logger.warn('Cache client not connected, skipping cache delete');
      return;
    }

    try {
      await this.client.del(key);
      logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  /**
   * Belirtilen pattern'e uyan tüm anahtarları siler
   * @param pattern - Silinecek anahtarların pattern'i (örn: "user:*")
   */
  public async delPattern(pattern: string): Promise<void> {
    if (isCacheDisabled) {
      return;
    }

    if (!this.client || !this.isConnected) {
      logger.warn('Cache client not connected, skipping cache pattern delete');
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug(`Cache deleted for pattern: ${pattern}, keys: ${keys.length}`);
      }
    } catch (error) {
      logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  /**
   * Cache bağlantısını kapatır
   */
  public async disconnect(): Promise<void> {
    if (isCacheDisabled) {
      return;
    }

    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Cache service disconnected');
    }
  }

  /**
   * Cache bağlantı durumunu kontrol eder
   */
  public isCacheConnected(): boolean {
    if (isCacheDisabled) {
      return false;
    }

    return this.isConnected && this.client !== null;
  }
}

export default CacheService;

