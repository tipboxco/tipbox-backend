import { createClient } from 'redis';
import logger from '../logger/logger';

export interface RedisConfig {
  url: string;
  pubClient: ReturnType<typeof createClient>;
  subClient: ReturnType<typeof createClient>;
}

class RedisConfigManager {
  private static instance: RedisConfigManager;
  private config: RedisConfig | null = null;

  private constructor() {}

  public static getInstance(): RedisConfigManager {
    if (!RedisConfigManager.instance) {
      RedisConfigManager.instance = new RedisConfigManager();
    }
    return RedisConfigManager.instance;
  }

  public async initialize(): Promise<RedisConfig> {
    if (this.config) {
      return this.config;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      // Publisher client with socket timeout
      const pubClient = createClient({ 
        url: redisUrl,
        socket: {
          connectTimeout: 10000, // 10 seconds
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 retries');
              return new Error('Redis reconnection limit exceeded');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });
      await pubClient.connect();
      
      // Subscriber client with socket timeout
      const subClient = createClient({ 
        url: redisUrl,
        socket: {
          connectTimeout: 10000, // 10 seconds
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 retries');
              return new Error('Redis reconnection limit exceeded');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });
      await subClient.connect();

      // Error handling
      pubClient.on('error', (err) => {
        logger.error('Redis Publisher Client Error:', err);
      });

      subClient.on('error', (err) => {
        logger.error('Redis Subscriber Client Error:', err);
      });

      this.config = {
        url: redisUrl,
        pubClient,
        subClient,
      };

      logger.info('Redis clients initialized successfully');
      return this.config;
    } catch (error) {
      logger.error('Failed to initialize Redis clients:', error);
      throw error;
    }
  }

  public getConfig(): RedisConfig {
    if (!this.config) {
      throw new Error('Redis config not initialized. Call initialize() first.');
    }
    return this.config;
  }

  public async disconnect(): Promise<void> {
    if (this.config) {
      await Promise.all([
        this.config.pubClient.disconnect(),
        this.config.subClient.disconnect(),
      ]);
      this.config = null;
      logger.info('Redis clients disconnected');
    }
  }

  /**
   * Redis URL'den host'u parse eder
   * Örnek: redis://redis:6379 -> redis
   */
  public static parseRedisHost(redisUrl?: string): string {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    
    if (url.includes('://')) {
      const urlWithoutProtocol = url.split('://')[1];
      const parts = urlWithoutProtocol.split(':');
      return parts[0];
    }
    
    return 'localhost';
  }

  /**
   * Redis URL'den port'u parse eder
   * Örnek: redis://redis:6379 -> 6379
   */
  public static parseRedisPort(redisUrl?: string): number {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    
    if (url.includes('://')) {
      const urlWithoutProtocol = url.split('://')[1];
      const parts = urlWithoutProtocol.split(':');
      if (parts.length > 1) {
        return parseInt(parts[1], 10) || 6379;
      }
    }
    
    return 6379;
  }
}

export default RedisConfigManager;
