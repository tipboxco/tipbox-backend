// Load .env file but don't override existing environment variables (e.g., from Docker Compose)
import dotenv from 'dotenv';
dotenv.config({ override: false });
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import app from './app';
import logger from '../infrastructure/logger/logger';
import RedisConfigManager from '../infrastructure/config/redis.config';
import SocketConfigManager from '../infrastructure/config/socket.config';
import SocketManager from '../infrastructure/realtime/socket-manager';
import { CacheService } from '../infrastructure/cache/cache.service';
import QueueProvider from '../infrastructure/queue/queue.provider';
import { getPrisma } from '../infrastructure/repositories/prisma.client';
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // HTTP server oluştur
    const httpServer = http.createServer(app);

    // Prisma client'ı başlat (ID middleware ile birlikte)
    const prisma = getPrisma();

    // Redis konfigürasyonunu başlat
    const redisConfig = await RedisConfigManager.getInstance().initialize();
    
    // Cache servisini başlat
    const cacheService = CacheService.getInstance();
    await cacheService.connect();
    
    // Queue provider'ı başlat
    const queueProvider = QueueProvider.getInstance();
    await queueProvider.initialize();
    
    // Socket.IO konfigürasyonunu al
    const socketConfig = SocketConfigManager.getInstance().getConfig();

    // Socket.IO server'ı oluştur
    const io = new Server(httpServer, {
      cors: socketConfig.cors,
      transports: socketConfig.transports as any,
      allowEIO3: socketConfig.allowEIO3,
    });

    // Redis adapter'ı kur
    io.adapter(createAdapter(redisConfig.pubClient, redisConfig.subClient));

    // Socket handler'ı başlat
    SocketManager.getInstance().initialize(io);

    // Scheduled job'ları başlat (dynamic import - dosya yoksa hata vermez)
    let supportRequestAutoCompleteJob: any = null;
    try {
      const jobModule = await import('../infrastructure/jobs/support-request-auto-complete.job');
      if (jobModule?.SupportRequestAutoCompleteJob) {
        supportRequestAutoCompleteJob = new jobModule.SupportRequestAutoCompleteJob();
        supportRequestAutoCompleteJob.start();
        logger.info('SupportRequestAutoCompleteJob started successfully');
      }
    } catch (error: any) {
      // Dosya yoksa veya yüklenemezse, sadece uyarı ver ama sunucu başlamaya devam et
      logger.warn('SupportRequestAutoCompleteJob could not be loaded (optional):', error?.message || error);
    }

    // HTTP server'ı başlat
    httpServer.listen(PORT, () => {
      logger.info({ message: `Server running on port ${PORT} with Socket.IO, Redis Cache, and BullMQ support` });
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
      
      // Scheduled job'ları durdur
      if (supportRequestAutoCompleteJob && typeof supportRequestAutoCompleteJob.stop === 'function') {
        supportRequestAutoCompleteJob.stop();
      }
      
      // Cache ve queue servislerini kapat
      await cacheService.disconnect();
      await queueProvider.closeAllQueues();
      await RedisConfigManager.getInstance().disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      httpServer.close(() => {
        logger.info('HTTP server closed');
      });
      
      // Scheduled job'ları durdur
      if (supportRequestAutoCompleteJob && typeof supportRequestAutoCompleteJob.stop === 'function') {
        supportRequestAutoCompleteJob.stop();
      }
      
      // Cache ve queue servislerini kapat
      await cacheService.disconnect();
      await queueProvider.closeAllQueues();
      await RedisConfigManager.getInstance().disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 