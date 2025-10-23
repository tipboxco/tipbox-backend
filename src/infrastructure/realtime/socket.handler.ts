import { Server, Socket } from 'socket.io';
import { AuthService } from '../../application/auth/auth.service';
import logger from '../logger/logger';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    userEmail: string;
  };
}

export class SocketHandler {
  private io: Server;
  private authService: AuthService;

  constructor(io: Server) {
    this.io = io;
    this.authService = new AuthService();
  }

  public initialize(): void {
    this.setupAuthenticationMiddleware();
    this.setupConnectionHandlers();
    logger.info('SocketHandler initialized successfully');
  }

  private setupAuthenticationMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          logger.warn('Socket connection attempt without token');
          return next(new Error('Authentication token required'));
        }

        const user = await this.authService.validateToken(token);
        
        if (!user) {
          logger.warn('Socket connection attempt with invalid token');
          return next(new Error('Invalid authentication token'));
        }

        // Kullanıcı bilgilerini socket.data'ya ekle
        socket.data = {
          userId: user.id.toString(),
          userEmail: user.email,
        };

        logger.info(`Socket authenticated for user: ${user.email} (ID: ${user.id})`);
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.data.userId;
      const userEmail = socket.data.userEmail;

      logger.info(`User connected: ${userEmail} (ID: ${userId})`);

      // Kullanıcıyı kendi özel odasına ekle
      socket.join(userId);
      logger.info(`User ${userEmail} joined room: ${userId}`);

      // Bağlantı onayı gönder
      socket.emit('connected', {
        message: 'Successfully connected to server',
        userId,
        userEmail,
      });

      // Disconnect event handler
      socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${userEmail} (ID: ${userId}), reason: ${reason}`);
      });

      // Ping-pong için heartbeat
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Hata yakalama
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${userEmail}:`, error);
      });
    });
  }

  /**
   * Belirli bir kullanıcıya mesaj gönder
   */
  public sendMessageToUser(userId: string, event: string, payload: any): void {
    try {
      this.io.to(userId).emit(event, payload);
      logger.info(`Message sent to user ${userId}: ${event}`);
    } catch (error) {
      logger.error(`Failed to send message to user ${userId}:`, error);
    }
  }

  /**
   * Tüm bağlı client'lara yayın yap
   */
  public broadcast(event: string, payload: any): void {
    try {
      this.io.emit(event, payload);
      logger.info(`Broadcast message sent: ${event}`);
    } catch (error) {
      logger.error(`Failed to broadcast message:`, error);
    }
  }

  /**
   * Belirli bir odaya mesaj gönder
   */
  public sendToRoom(room: string, event: string, payload: any): void {
    try {
      this.io.to(room).emit(event, payload);
      logger.info(`Message sent to room ${room}: ${event}`);
    } catch (error) {
      logger.error(`Failed to send message to room ${room}:`, error);
    }
  }

  /**
   * Kullanıcının bağlı olup olmadığını kontrol et
   */
  public isUserConnected(userId: string): boolean {
    const room = this.io.sockets.adapter.rooms.get(userId);
    return room ? room.size > 0 : false;
  }

  /**
   * Bağlı kullanıcı sayısını al
   */
  public getConnectedUsersCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Belirli bir odadaki kullanıcı sayısını al
   */
  public getRoomUsersCount(room: string): number {
    const roomSet = this.io.sockets.adapter.rooms.get(room);
    return roomSet ? roomSet.size : 0;
  }
}
