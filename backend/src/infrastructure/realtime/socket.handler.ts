import { Server, Socket } from 'socket.io';
import { AuthService } from '../../application/auth/auth.service';
import logger from '../logger/logger';
import { InboxSocketService } from './services/inbox-socket.service';
import { ChatSocketService } from './services/chat-socket.service';
import { RequestSocketService } from './services/request-socket.service';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    userEmail: string;
  };
}

export class SocketHandler {
  private io: Server;
  private authService: AuthService;
  private inboxService: InboxSocketService;
  private chatService: ChatSocketService;
  private requestService: RequestSocketService;

  constructor(io: Server) {
    this.io = io;
    this.authService = new AuthService();
    // Modüler socket servislerini initialize et
    this.inboxService = new InboxSocketService(this);
    this.chatService = new ChatSocketService(this);
    this.requestService = new RequestSocketService(this);
  }

  public initialize(): void {
    this.setupAuthenticationMiddleware();
    this.setupConnectionHandlers();
    logger.info('SocketHandler initialized successfully');
  }

  private setupAuthenticationMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        // Detaylı bağlantı bilgileri
        const origin = socket.handshake.headers.origin;
        const userAgent = socket.handshake.headers['user-agent'];
        const ip = socket.handshake.address;
        const socketId = socket.id;
        
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('🔌 SOCKET BAĞLANTI İSTEĞİ');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info(`   Socket ID: ${socketId}`);
        logger.info(`   Origin: ${origin || 'none (mobil app)'}`);
        logger.info(`   User-Agent: ${userAgent || 'none'}`);
        logger.info(`   IP Address: ${ip || 'unknown'}`);
        logger.info('───────────────────────────────────────────────────────');
        
        const token = socket.handshake.auth.token;
        
        if (!token) {
          logger.warn('❌ JWT TOKEN YOK - Bağlantı reddedildi');
          logger.info('═══════════════════════════════════════════════════════');
          return next(new Error('Authentication token required'));
        }

        logger.info(`🔐 JWT TOKEN ALINDI - Token uzunluğu: ${token.length} karakter`);
        logger.info('   Token doğrulanıyor...');

        const user = await this.authService.validateToken(token);
        
        if (!user) {
          logger.warn('❌ JWT TOKEN GEÇERSİZ - Bağlantı reddedildi');
          logger.info('═══════════════════════════════════════════════════════');
          return next(new Error('Invalid authentication token'));
        }

        // Kullanıcı bilgilerini socket.data'ya ekle
        socket.data = {
          userId: user.id.toString(),
          userEmail: user.email,
        };

        logger.info(`✅ JWT TOKEN DOĞRULANDI`);
        logger.info(`   Kullanıcı: ${user.email}`);
        logger.info(`   User ID: ${user.id}`);
        logger.info('═══════════════════════════════════════════════════════');
        next();
      } catch (error) {
        logger.error('❌ SOCKET AUTHENTICATION HATASI:', error);
        logger.info('═══════════════════════════════════════════════════════');
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.data.userId;
      const userEmail = socket.data.userEmail;
      const socketId = socket.id;

      logger.info('═══════════════════════════════════════════════════════');
      logger.info('✅ SOCKET BAĞLANTISI KURULDU');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`   Socket ID: ${socketId}`);
      logger.info(`   Kullanıcı: ${userEmail}`);
      logger.info(`   User ID: ${userId}`);
      logger.info('───────────────────────────────────────────────────────');

      // Kullanıcıyı kendi özel odasına ekle
      socket.join(userId);
      logger.info(`📦 Kullanıcı room'una eklendi: ${userId}`);

      // Bağlantı onayı gönder
      socket.emit('connected', {
        message: 'Successfully connected to server',
        userId,
        userEmail,
      });
      logger.info(`📤 'connected' event'i gönderildi`);

      // Modüler socket servislerini initialize et
      this.inboxService.setupHandlers(socket);
      this.chatService.setupHandlers(socket);
      this.requestService.setupHandlers(socket);
      logger.info(`📦 Socket servisleri initialize edildi (inbox, chat, request)`);
      logger.info('═══════════════════════════════════════════════════════');

      // Disconnect event handler
      socket.on('disconnect', (reason) => {
        logger.info('═══════════════════════════════════════════════════════');
        logger.info('🔌 SOCKET BAĞLANTISI KESİLDİ');
        logger.info('═══════════════════════════════════════════════════════');
        logger.info(`   Kullanıcı: ${userEmail} (ID: ${userId})`);
        logger.info(`   Socket ID: ${socketId}`);
        logger.info(`   Sebep: ${reason}`);
        logger.info('═══════════════════════════════════════════════════════');
      });

      // Ping-pong için heartbeat
      socket.on('ping', () => {
        socket.emit('pong');
        logger.debug(`💓 Ping-Pong: ${userEmail} (${socketId})`);
      });

      // Hata yakalama
      socket.on('error', (error) => {
        logger.error('═══════════════════════════════════════════════════════');
        logger.error('❌ SOCKET HATASI');
        logger.error('═══════════════════════════════════════════════════════');
        logger.error(`   Kullanıcı: ${userEmail} (ID: ${userId})`);
        logger.error(`   Socket ID: ${socketId}`);
        logger.error(`   Hata:`, error);
        logger.error('═══════════════════════════════════════════════════════');
      });
    });
  }


  /**
   * Belirli bir kullanıcıya mesaj gönder
   */
  public sendMessageToUser(userId: string, event: string, payload: unknown): void {
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
  public broadcast(event: string, payload: unknown): void {
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
  public sendToRoom(room: string, event: string, payload: unknown): void {
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