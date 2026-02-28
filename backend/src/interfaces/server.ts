// Load .env file but don't override existing environment variables (e.g., from Docker Compose)
import dotenv from 'dotenv';
dotenv.config({ override: false });
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import app from './app';
import logger from '../infrastructure/logger/logger';
import RedisConfigManager from '../infrastructure/config/redis.config';
import { getSocketConfig } from '../infrastructure/config/socket.config';
import SocketManager from '../infrastructure/realtime/socket-manager';
import { CacheService } from '../infrastructure/cache/cache.service';
import QueueProvider from '../infrastructure/queue/queue.provider';
import { getPrisma } from '../infrastructure/repositories/prisma.client';
import WorkerManager from '../infrastructure/workers';
import { maybeBackfillFeedOnStartup } from '../infrastructure/scheduler/feed-distribution.startup-backfill';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    // HTTP server oluştur
    const httpServer = http.createServer(app);

    // Prisma client'ı başlat (ID middleware ile birlikte)
    const prisma = getPrisma();
    
    // Prisma'yı veritabanına bağla
    await prisma.$connect();
    logger.info({ message: 'Prisma connected to database successfully' });

    // Redis konfigürasyonunu başlat
    const redisConfig = await RedisConfigManager.getInstance().initialize();
    
    // Cache servisini başlat
    const cacheService = CacheService.getInstance();
    await cacheService.connect();
    
    // Queue provider'ı başlat
    const queueProvider = QueueProvider.getInstance();
    await queueProvider.initialize();
    
    // Socket.IO konfigürasyonunu al
    const socketConfig = getSocketConfig();

    // Socket.IO server'ı oluştur
    const io = new Server(httpServer, {
      cors: socketConfig.cors,
      transports: socketConfig.transports,
      allowEIO3: socketConfig.allowEIO3,
      path: socketConfig.path,
      connectTimeout: socketConfig.connectTimeout,
      pingTimeout: socketConfig.pingTimeout,
      pingInterval: socketConfig.pingInterval,
    });

    // Redis adapter'ı kur
    io.adapter(createAdapter(redisConfig.pubClient, redisConfig.subClient));

    // Socket handler'ı başlat
    SocketManager.getInstance().initialize(io);

    // Worker'ları başlat
    const workerManager = new WorkerManager();
    await workerManager.startAll();

    // Feed tablosu boş + queue idle ise (ör: seed sonrası/restart), feed distribution job'larını otomatik kuyruğa al.
    // Non-blocking: server boot'u bekletmesin.
    void maybeBackfillFeedOnStartup();

    // HTTP server'ı başlat - 0.0.0.0 tüm ağ arayüzlerinde dinler (local network erişimi için)
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info({ message: `Server running on port ${PORT} with Socket.IO, Redis Cache, and BullMQ support` });
      logger.info({ message: `Server accessible at http://localhost:${PORT} and http://<your-ip>:${PORT}` });
    });

    // Graceful shutdown - tek handler, duplicate risk yok
    let isShuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`${signal} received, shutting down gracefully`);

      try {
        await workerManager.stopAll();

        httpServer.close(() => {
          logger.info('HTTP server closed');
        });

        await prisma.$disconnect();
        logger.info('Prisma disconnected');

        await cacheService.disconnect();
        await queueProvider.closeAllQueues();
        await RedisConfigManager.getInstance().disconnect();
      } catch (shutdownError) {
        logger.error('Error during graceful shutdown', {
          error: shutdownError instanceof Error ? shutdownError.message : String(shutdownError),
        });
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 