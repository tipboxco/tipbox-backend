import 'dotenv/config';
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
import { PrismaClient } from '@prisma/client';
import { registerIdMiddleware } from '../infrastructure/repositories/prisma-id-middleware';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // HTTP server oluştur
    const httpServer = http.createServer(app);

    // Prisma middleware: ID stratejisi
    const prisma = new PrismaClient();
    registerIdMiddleware(prisma);

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