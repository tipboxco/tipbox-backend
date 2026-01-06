import { AuthenticatedSocket } from '../socket.handler';
import { SocketHandler } from '../socket.handler';
import logger from '../../logger/logger';
import { DMThreadPrismaRepository } from '../../repositories/dm-thread-prisma.repository';
import { DmMessagePrismaRepository } from '../../repositories/dm-message-prisma.repository';

export class InboxSocketService {
  private socketHandler: SocketHandler;
  private threadRepo = new DMThreadPrismaRepository();
  private messageRepo = new DmMessagePrismaRepository();

  constructor(socketHandler: SocketHandler) {
    this.socketHandler = socketHandler;
  }

  /**
   * Socket bağlantısı için inbox event handler'larını kur
   */
  public setupHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId;

    // Thread'e katıl
    socket.on('join_thread', async (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          socket.emit('error', { message: 'threadId is required' });
          return;
        }

        // Thread'in kullanıcıya ait olduğunu kontrol et
        const thread = await this.threadRepo.findById(threadId);
        if (!thread) {
          socket.emit('error', { message: 'Thread not found' });
          return;
        }

        const isParticipant =
          thread.userOneId === userId || thread.userTwoId === userId;

        if (!isParticipant) {
          socket.emit('error', { message: 'Unauthorized access to thread' });
          return;
        }

        // Thread room'una katıl
        socket.join(`thread:${threadId}`);
        logger.info(
          `User ${userId} joined thread ${threadId} (socket: ${socket.id})`
        );

        // Onay gönder
        socket.emit('thread_joined', { threadId });

        // Thread'deki diğer kullanıcılara bildir (opsiyonel)
        socket.to(`thread:${threadId}`).emit('user_joined_thread', {
          threadId,
          userId,
        });
      } catch (error) {
        logger.error('Error in join_thread handler:', error);
        socket.emit('error', { message: 'Failed to join thread' });
      }
    });

    // Thread'den ayrıl
    socket.on('leave_thread', async (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          socket.emit('error', { message: 'threadId is required' });
          return;
        }

        socket.leave(`thread:${threadId}`);
        logger.info(
          `User ${userId} left thread ${threadId} (socket: ${socket.id})`
        );

        // Onay gönder
        socket.emit('thread_left', { threadId });

        // Thread'deki diğer kullanıcılara bildir (opsiyonel)
        socket.to(`thread:${threadId}`).emit('user_left_thread', {
          threadId,
          userId,
        });
      } catch (error) {
        logger.error('Error in leave_thread handler:', error);
        socket.emit('error', { message: 'Failed to leave thread' });
      }
    });

    // Yazıyor göstergesi başlat
    socket.on('typing_start', async (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          return;
        }

        // Thread'in kullanıcıya ait olduğunu kontrol et
        const thread = await this.threadRepo.findById(threadId);
        if (!thread) {
          return;
        }

        const isParticipant =
          thread.userOneId === userId || thread.userTwoId === userId;

        if (!isParticipant) {
          return;
        }

        // Thread'deki diğer kullanıcılara bildir (gönderen hariç)
        socket.to(`thread:${threadId}`).emit('user_typing', {
          threadId,
          userId,
          isTyping: true,
        });
      } catch (error) {
        logger.error('Error in typing_start handler:', error);
      }
    });

    // Yazıyor göstergesi durdur
    socket.on('typing_stop', async (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          return;
        }

        // Thread'in kullanıcıya ait olduğunu kontrol et
        const thread = await this.threadRepo.findById(threadId);
        if (!thread) {
          return;
        }

        const isParticipant =
          thread.userOneId === userId || thread.userTwoId === userId;

        if (!isParticipant) {
          return;
        }

        // Thread'deki diğer kullanıcılara bildir (gönderen hariç)
        socket.to(`thread:${threadId}`).emit('user_typing', {
          threadId,
          userId,
          isTyping: false,
        });
      } catch (error) {
        logger.error('Error in typing_stop handler:', error);
      }
    });
  }
}







