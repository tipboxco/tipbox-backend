import { createClient, RedisClientType } from 'redis';
import logger from '../logger/logger';

// CACHE_ENABLED === 'false' ise cache tamamen devre dışı
const isCacheDisabled = process.env.CACHE_ENABLED === 'false';

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType | null = null;
  private isConnected = false;

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
      
      this.client = createClient({ url: redisUrl });
      
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
   * Redis'ten veri alır ve JSON.parse ile objeye çevirir
   * @param key - Cache anahtarı
   * @returns Parsed data veya null
   */
  public async get<T>(key: string): Promise<T | null> {
    if (isCacheDisabled) {
      return null;
    }

    if (!this.client || !this.isConnected) {
      logger.warn('Cache client not connected, skipping cache get');
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error);
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

    if (!this.client || !this.isConnected) {
      logger.warn('Cache client not connected, skipping cache set');
      return;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, ttlInSeconds, serializedValue);
      logger.debug(`Cache set for key: ${key}, TTL: ${ttlInSeconds}s`);
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error);
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

