import { Server, Socket } from 'socket.io';
import { AuthService } from '../../application/auth/auth.service';
import { MessagingService } from '../../application/messaging/messaging.service';
import { SupportRequestService } from '../../application/messaging/support-request.service';
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
  private supportRequestService: SupportRequestService;

  constructor(io: Server) {
    this.io = io;
    this.authService = new AuthService();
    this.messagingService = new MessagingService();
    this.supportRequestService = new SupportRequestService();
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

      // Message sending handlers
      this.setupMessageHandlers(socket);

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
   * Mesaj gönderme için event handler'ları
   */
  private setupMessageHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId;
    const userEmail = socket.data.userEmail;

    // send_message event handler (normal DM mesajları için)
    socket.on('send_message', async (data: { threadId: string; message: string }) => {
      try {
        const { threadId, message } = data || {};
        
        if (!threadId || typeof threadId !== 'string') {
          socket.emit('message_send_error', {
            reason: 'Invalid threadId',
          });
          return;
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
          socket.emit('message_send_error', {
            reason: 'Message is required',
          });
          return;
        }

        // Thread erişim kontrolü
        const hasAccess = await this.messagingService.validateThreadAccess(threadId, userId);
        if (!hasAccess) {
          socket.emit('message_send_error', {
            reason: 'Access denied: User is not a participant of this thread',
          });
          logger.warn(`User ${userEmail} (${userId}) attempted to send message to thread ${threadId} without access`);
          return;
        }

        // Thread'i al ve recipientId'yi bul
        const thread = await this.messagingService.getThreadById(threadId);
        if (!thread) {
          socket.emit('message_send_error', {
            reason: 'Thread not found',
          });
          return;
        }

        // Thread'in support thread olmadığını kontrol et
        if (thread.isSupportContext()) {
          socket.emit('message_send_error', {
            reason: 'Use send_support_message for support chat messages',
          });
          return;
        }

        // RecipientId'yi bul
        const recipientId = thread.userOneId === userId ? thread.userTwoId : thread.userOneId;

        // Mesajı gönder (internal service call)
        await this.messagingService.sendDirectMessage(userId, recipientId, message.trim());
        
        logger.info(`Message sent via socket: User ${userEmail} in thread ${threadId}`);
      } catch (error: any) {
        logger.error(`Error handling send_message for user ${userEmail}:`, error);
        socket.emit('message_send_error', {
          reason: error.message || 'Failed to send message',
        });
      }
    });

    // send_support_message event handler (support chat mesajları için)
    socket.on('send_support_message', async (data: { threadId: string; message: string }) => {
      try {
        const { threadId, message } = data || {};
        
        if (!threadId || typeof threadId !== 'string') {
          socket.emit('message_send_error', {
            reason: 'Invalid threadId',
          });
          return;
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
          socket.emit('message_send_error', {
            reason: 'Message is required',
          });
          return;
        }

        // Thread erişim kontrolü
        const hasAccess = await this.messagingService.validateThreadAccess(threadId, userId);
        if (!hasAccess) {
          socket.emit('message_send_error', {
            reason: 'Access denied: User is not a participant of this thread',
          });
          logger.warn(`User ${userEmail} (${userId}) attempted to send support message to thread ${threadId} without access`);
          return;
        }

        // Thread'in support thread olduğunu kontrol et
        const thread = await this.messagingService.getThreadById(threadId);
        if (!thread?.isSupportContext()) {
          socket.emit('message_send_error', {
            reason: 'Thread is not a support chat',
          });
          return;
        }

        // Support chat mesajını gönder (internal service call)
        await this.messagingService.sendSupportChatMessage(threadId, userId, message.trim());
        
        logger.info(`Support message sent via socket: User ${userEmail} in thread ${threadId}`);
      } catch (error: any) {
        logger.error(`Error handling send_support_message for user ${userEmail}:`, error);
        socket.emit('message_send_error', {
          reason: error.message || 'Failed to send support message',
        });
      }
    });

    socket.on('send_tips', async (data: { threadId?: string; recipientUserId?: string; amount: number; message?: string }, callback?: (response: { success?: boolean; error?: string }) => void) => {
      try {
        const { threadId, recipientUserId, amount, message } = data || {};
        const numericAmount = Number(amount);

        if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
          this.emitTipsError(socket, 'Amount must be greater than zero', callback);
          return;
        }

        let targetUserId = recipientUserId;

        if (!targetUserId) {
          if (!threadId) {
            this.emitTipsError(socket, 'recipientUserId or threadId is required', callback);
            return;
          }

          const thread = await this.messagingService.getThreadById(threadId);
          if (!thread) {
            this.emitTipsError(socket, 'Thread not found', callback);
            return;
          }

          if (!thread.belongsToUser(userId)) {
            this.emitTipsError(socket, 'Access denied: User is not a participant of this thread', callback);
            return;
          }

          targetUserId = thread.getOtherUserId(userId);
        }

        if (!targetUserId) {
          this.emitTipsError(socket, 'recipientUserId could not be determined', callback);
          return;
        }

        await this.messagingService.sendTips(userId, targetUserId, numericAmount, (message ?? '').trim());
        callback?.({ success: true });
      } catch (error: any) {
        logger.error(`Error handling send_tips for user ${userEmail}:`, error);
        this.emitTipsError(socket, error.message || 'Failed to send TIPS', callback);
      }
    });

    socket.on('create_support_request', async (data: { threadId?: string; recipientUserId?: string; type: string; message: string; amount: number }, callback?: (response: { success?: boolean; error?: string }) => void) => {
      try {
        const { threadId, recipientUserId, type, message, amount } = data || {};
        const trimmedMessage = (message ?? '').trim();
        if (!trimmedMessage) {
          this.emitSupportRequestError(socket, 'Message is required', callback);
          return;
        }

        const normalizedType = (type || 'GENERAL').toUpperCase();
        if (!['GENERAL', 'TECHNICAL', 'PRODUCT'].includes(normalizedType)) {
          this.emitSupportRequestError(socket, 'Invalid support request type', callback);
          return;
        }

        const numericAmount = Number(amount ?? 0);
        if (Number.isNaN(numericAmount) || numericAmount < 0) {
          this.emitSupportRequestError(socket, 'Amount must be a positive number', callback);
          return;
        }

        let targetUserId = recipientUserId;
        if (!targetUserId) {
          if (!threadId) {
            this.emitSupportRequestError(socket, 'recipientUserId or threadId is required', callback);
            return;
          }

          const thread = await this.messagingService.getThreadById(threadId);
          if (!thread) {
            this.emitSupportRequestError(socket, 'Thread not found', callback);
            return;
          }

          if (!thread.belongsToUser(userId)) {
            this.emitSupportRequestError(socket, 'Access denied: User is not a participant of this thread', callback);
            return;
          }

          targetUserId = thread.getOtherUserId(userId);
        }

        if (!targetUserId) {
          this.emitSupportRequestError(socket, 'recipientUserId could not be determined', callback);
          return;
        }

        await this.supportRequestService.createSupportRequest(userId, {
          recipientUserId: targetUserId,
          type: normalizedType,
          message: trimmedMessage,
          amount: numericAmount,
        });

        callback?.({ success: true });
      } catch (error: any) {
        logger.error(`Error handling create_support_request for user ${userEmail}:`, error);
        this.emitSupportRequestError(socket, error.message || 'Failed to create support request', callback);
      }
    });

    // cancel_support_request event handler (sender tarafından cancel)
    socket.on('cancel_support_request', async (data: { requestId: string }, callback?: (response: { success?: boolean; error?: string }) => void) => {
      try {
        const { requestId } = data || {};
        
        if (!requestId || typeof requestId !== 'string') {
          this.emitSupportRequestError(socket, 'requestId is required', callback);
          return;
        }

        await this.supportRequestService.cancelSupportRequest(requestId, userId);
        callback?.({ success: true });
      } catch (error: any) {
        logger.error(`Error handling cancel_support_request for user ${userEmail}:`, error);
        this.emitSupportRequestError(socket, error.message || 'Failed to cancel support request', callback);
      }
    });

    // close_support_request event handler (her iki kullanıcı da close yapabilir, rating ile)
    socket.on('close_support_request', async (data: { requestId: string; rating: number }, callback?: (response: { success?: boolean; error?: string }) => void) => {
      try {
        const { requestId, rating } = data || {};
        
        if (!requestId || typeof requestId !== 'string') {
          this.emitSupportRequestError(socket, 'requestId is required', callback);
          return;
        }

        const numericRating = Number(rating);
        if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
          this.emitSupportRequestError(socket, 'Rating must be between 1 and 5', callback);
          return;
        }

        await this.supportRequestService.closeSupportRequest(requestId, userId, numericRating);
        callback?.({ success: true });
      } catch (error: any) {
        logger.error(`Error handling close_support_request for user ${userEmail}:`, error);
        this.emitSupportRequestError(socket, error.message || 'Failed to close support request', callback);
      }
    });

    // report_support_request event handler
    socket.on('report_support_request', async (data: { requestId: string; category: string; description?: string }, callback?: (response: { success?: boolean; error?: string }) => void) => {
      try {
        const { requestId, category, description } = data || {};

        if (!requestId || typeof requestId !== 'string') {
          this.emitSupportRequestError(socket, 'requestId is required', callback);
          return;
        }

        if (!category || typeof category !== 'string') {
          this.emitSupportRequestError(socket, 'category is required', callback);
          return;
        }

        const normalizedCategory = category.toUpperCase();
        if (!SupportRequestService.REPORT_CATEGORIES.includes(normalizedCategory as any)) {
          this.emitSupportRequestError(socket, 'Invalid report category', callback);
          return;
        }

        const sanitizedDescription = description?.trim();
        if (sanitizedDescription && sanitizedDescription.length > 500) {
          this.emitSupportRequestError(socket, 'Description is too long (max 500 chars)', callback);
          return;
        }

        await this.supportRequestService.reportSupportRequest(
          requestId,
          userId,
          normalizedCategory as any,
          sanitizedDescription,
        );

        callback?.({ success: true });
      } catch (error: any) {
        logger.error(`Error handling report_support_request for user ${userEmail}:`, error);
        this.emitSupportRequestError(socket, error.message || 'Failed to report support request', callback);
      }
    });
  }

  private emitTipsError(socket: AuthenticatedSocket, reason: string, callback?: (response: { error?: string }) => void) {
    socket.emit('tips_send_error', { reason });
    callback?.({ error: reason });
  }

  private emitSupportRequestError(socket: AuthenticatedSocket, reason: string, callback?: (response: { error?: string }) => void) {
    socket.emit('support_request_error', { reason });
    callback?.({ error: reason });
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
      // Kullanıcılar connection handler'da kendi userId room'una katılıyor (socket.join(userId))
      // Room adı userId string olarak kullanılıyor
      const roomName = String(userId);
      this.io.to(roomName).emit(event, payload);
      logger.info(`Message sent to user ${userId} (room: ${roomName}): ${event}`);
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