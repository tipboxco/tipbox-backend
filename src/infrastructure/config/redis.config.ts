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
      // Publisher client
      const pubClient = createClient({ url: redisUrl });
      await pubClient.connect();
      
      // Subscriber client
      const subClient = createClient({ url: redisUrl });
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
}

export default RedisConfigManager;
