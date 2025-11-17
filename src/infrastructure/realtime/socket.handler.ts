import { Server, Socket } from 'socket.io';
import { AuthService } from '../../application/auth/auth.service';
import { MessagingService } from '../../application/messaging/messaging.service';
import { TypingEvent } from './messaging-events';
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
  private messagingService: MessagingService;

  constructor(io: Server) {
    this.io = io;
    this.authService = new AuthService();
    this.messagingService = new MessagingService();
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

      // Thread room yönetimi
      this.setupThreadHandlers(socket);

      // Typing indicators
      this.setupTypingHandlers(socket);

      // Hata yakalama
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${userEmail}:`, error);
      });
    });
  }

  /**
   * Thread room yönetimi için event handler'ları
   */
  private setupThreadHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId;
    const userEmail = socket.data.userEmail;

    // join_thread event handler
    socket.on('join_thread', async (threadId: string) => {
      try {
        if (!threadId || typeof threadId !== 'string') {
          socket.emit('thread_join_error', {
            threadId: threadId || 'unknown',
            reason: 'Invalid threadId',
          });
          return;
        }

        // Thread erişim kontrolü
        const hasAccess = await this.messagingService.validateThreadAccess(threadId, userId);
        if (!hasAccess) {
          socket.emit('thread_join_error', {
            threadId,
            reason: 'Access denied: User is not a participant of this thread',
          });
          logger.warn(`User ${userEmail} (${userId}) attempted to join thread ${threadId} without access`);
          return;
        }

        // Thread room'una katıl
        const roomName = `thread:${threadId}`;
        socket.join(roomName);
        logger.info(`User ${userEmail} (${userId}) joined thread room: ${roomName}`);

        // Thread'deki tüm mesajları okundu olarak işaretle
        try {
          await this.messagingService.markAllMessagesAsReadInThread(threadId, userId);
        } catch (error) {
          logger.error(`Failed to mark messages as read when joining thread ${threadId}:`, error);
          // Hata olsa bile thread'e katılmaya devam et
        }

        // Başarılı katılım bildirimi
        socket.emit('thread_joined', { threadId });
      } catch (error) {
        logger.error(`Error joining thread for user ${userEmail}:`, error);
        socket.emit('thread_join_error', {
          threadId: typeof threadId === 'string' ? threadId : 'unknown',
          reason: 'Internal server error',
        });
      }
    });

    // leave_thread event handler
    socket.on('leave_thread', (threadId: string) => {
      try {
        if (!threadId || typeof threadId !== 'string') {
          logger.warn(`Invalid threadId for leave_thread from user ${userEmail}`);
          return;
        }

        const roomName = `thread:${threadId}`;
        socket.leave(roomName);
        logger.info(`User ${userEmail} (${userId}) left thread room: ${roomName}`);

        // Başarılı ayrılma bildirimi
        socket.emit('thread_left', { threadId });
      } catch (error) {
        logger.error(`Error leaving thread for user ${userEmail}:`, error);
      }
    });
  }

  /**
   * Typing indicators için event handler'ları
   */
  private setupTypingHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId;
    const userEmail = socket.data.userEmail;

    // typing_start event handler
    socket.on('typing_start', async (data: { threadId: string }) => {
      try {
        const { threadId } = data || {};
        
        if (!threadId || typeof threadId !== 'string') {
          logger.warn(`Invalid threadId for typing_start from user ${userEmail}`);
          return;
        }

        // Thread erişim kontrolü
        const hasAccess = await this.messagingService.validateThreadAccess(threadId, userId);
        if (!hasAccess) {
          logger.warn(`User ${userEmail} (${userId}) attempted typing_start for thread ${threadId} without access`);
          return;
        }

        // Thread bilgisini al (diğer kullanıcıyı bulmak için)
        const thread = await this.messagingService.getThreadById(threadId);
        if (!thread) {
          logger.warn(`Thread ${threadId} not found for typing_start`);
          return;
        }

        const otherUserId = thread.userOneId === userId ? thread.userTwoId : thread.userOneId;
        const roomName = `thread:${threadId}`;
        const typingEvent: TypingEvent = {
          userId,
          threadId,
          isTyping: true,
        };

        // Thread room'una gönder (thread açık olan kullanıcılar için)
        socket.to(roomName).emit('user_typing', typingEvent);
        
        // Diğer kullanıcının kişisel room'una da gönder (mesaj listesindeyken görmesi için)
        this.sendMessageToUser(otherUserId, 'user_typing', typingEvent);
        
        logger.debug(`Typing started: User ${userEmail} in thread ${threadId}`);
      } catch (error) {
        logger.error(`Error handling typing_start for user ${userEmail}:`, error);
      }
    });

    // typing_stop event handler
    socket.on('typing_stop', async (data: { threadId: string }) => {
      try {
        const { threadId } = data || {};
        
        if (!threadId || typeof threadId !== 'string') {
          logger.warn(`Invalid threadId for typing_stop from user ${userEmail}`);
          return;
        }

        // Thread erişim kontrolü
        const hasAccess = await this.messagingService.validateThreadAccess(threadId, userId);
        if (!hasAccess) {
          logger.warn(`User ${userEmail} (${userId}) attempted typing_stop for thread ${threadId} without access`);
          return;
        }

        // Thread bilgisini al (diğer kullanıcıyı bulmak için)
        const thread = await this.messagingService.getThreadById(threadId);
        if (!thread) {
          logger.warn(`Thread ${threadId} not found for typing_stop`);
          return;
        }

        const otherUserId = thread.userOneId === userId ? thread.userTwoId : thread.userOneId;
        const roomName = `thread:${threadId}`;
        const typingEvent: TypingEvent = {
          userId,
          threadId,
          isTyping: false,
        };

        // Thread room'una gönder (thread açık olan kullanıcılar için)
        socket.to(roomName).emit('user_typing', typingEvent);
        
        // Diğer kullanıcının kişisel room'una da gönder (mesaj listesindeyken görmesi için)
        this.sendMessageToUser(otherUserId, 'user_typing', typingEvent);
        
        logger.debug(`Typing stopped: User ${userEmail} in thread ${threadId}`);
      } catch (error) {
        logger.error(`Error handling typing_stop for user ${userEmail}:`, error);
      }
    });
  }

  /**
   * Belirli bir kullanıcıya mesaj gönder
   */
  public sendMessageToUser(userId: string, event: string, payload: any): void {
    try {
      // Kullanıcılar user:{userId} room'una katılıyor
      this.io.to(userId).emit(event, payload);
      logger.debug(`Message sent to user ${userId}: ${event}`);
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
