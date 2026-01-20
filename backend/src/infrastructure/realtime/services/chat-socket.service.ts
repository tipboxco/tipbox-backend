import { AuthenticatedSocket } from '../socket.handler';
import { SocketHandler } from '../socket.handler';
import logger from '../../logger/logger';
import { MessagingService } from '../../../application/messaging/messaging.service';
import { DMThreadPrismaRepository } from '../../repositories/dm-thread-prisma.repository';
import { DmMessagePrismaRepository } from '../../repositories/dm-message-prisma.repository';

export class ChatSocketService {
  private socketHandler: SocketHandler;
  private messagingService: MessagingService;
  private threadRepo = new DMThreadPrismaRepository();
  private messageRepo = new DmMessagePrismaRepository();
  private typingTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(socketHandler: SocketHandler) {
    this.socketHandler = socketHandler;
    this.messagingService = new MessagingService();
  }

  /**
   * Socket bağlantısı için chat event handler'larını kur
   */
  public setupHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId;

    // Direkt mesaj gönder (DM)
    socket.on('send_message', async (data: { recipientId: string; message: string }) => {
      try {
        const { recipientId, message } = data;

        if (!recipientId || !message) {
          socket.emit('error', {
            message: 'recipientId and message are required',
          });
          return;
        }

        if (message.trim().length === 0) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        // MessagingService ile mesaj gönder
        // Bu servis zaten socket event'lerini gönderiyor
        await this.messagingService.sendDirectMessage(
          userId,
          recipientId,
          message
        );

        logger.info(
          `Message sent via socket from ${userId} to ${recipientId}`
        );
      } catch (error: any) {
        logger.error('Error in send_message handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to send message',
        });
      }
    });

    // Support mesajı gönder
    socket.on('send_support_message', async (data: { threadId: string; message: string }) => {
      try {
        const { threadId, message } = data;

        if (!threadId || !message) {
          socket.emit('error', {
            message: 'threadId and message are required',
          });
          return;
        }

        if (message.trim().length === 0) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        // Thread'in kullanıcıya ait olduğunu ve support thread olduğunu kontrol et
        const thread = await this.threadRepo.findById(threadId);
        if (!thread) {
          socket.emit('error', { message: 'Thread not found' });
          return;
        }

        if (!thread.isSupportThread) {
          socket.emit('error', {
            message: 'This is not a support thread',
          });
          return;
        }

        const isParticipant =
          thread.userOneId === userId || thread.userTwoId === userId;

        if (!isParticipant) {
          socket.emit('error', { message: 'Unauthorized access to thread' });
          return;
        }

        // Support mesajı gönder
        const recipientId =
          thread.userOneId === userId ? thread.userTwoId : thread.userOneId;

        await this.messagingService.sendSupportChatMessage(
          threadId,
          userId,
          message
        );

        logger.info(
          `Support message sent via socket from ${userId} to ${recipientId} in thread ${threadId}`
        );
      } catch (error: any) {
        logger.error('Error in send_support_message handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to send support message',
        });
      }
    });

    // Mesajı okundu işaretle
    socket.on('mark_message_read', async (data: { messageId: string }) => {
      try {
        const { messageId } = data;

        if (!messageId) {
          socket.emit('error', { message: 'messageId is required' });
          return;
        }

        // Mesajı bul
        const message = await this.messageRepo.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Mesajın alıcısı kontrol et
        if (message.senderId === userId) {
          socket.emit('error', {
            message: 'You cannot mark your own message as read',
          });
          return;
        }

        // Thread'i bul
        const thread = await this.threadRepo.findById(message.threadId);
        if (!thread) {
          socket.emit('error', { message: 'Thread not found' });
          return;
        }

        // Kullanıcının thread'de olduğunu kontrol et
        const isParticipant =
          thread.userOneId === userId || thread.userTwoId === userId;

        if (!isParticipant) {
          socket.emit('error', { message: 'Unauthorized access to message' });
          return;
        }

        // Mesaj zaten okunmuş mu kontrol et
        if (message.isRead) {
          socket.emit('message_read', {
            messageId,
            threadId: message.threadId,
            readBy: userId,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Mesajı okundu işaretle
        await this.messageRepo.markAsRead(messageId);

        const readEvent = {
          messageId,
          threadId: message.threadId,
          readBy: userId,
          timestamp: new Date().toISOString(),
        };

        // Göndericiye bildir
        this.socketHandler.sendMessageToUser(
          message.senderId,
          'message_read',
          readEvent
        );

        // Thread room'una bildir
        this.socketHandler.sendToRoom(
          `thread:${message.threadId}`,
          'message_read',
          readEvent
        );

        // Onay gönder
        socket.emit('message_read', readEvent);

        logger.info(
          `Message ${messageId} marked as read by ${userId} in thread ${message.threadId}`
        );
      } catch (error: any) {
        logger.error('Error in mark_message_read handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to mark message as read',
        });
      }
    });

    // Tüm thread mesajlarını okundu işaretle
    socket.on('mark_thread_read', async (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          socket.emit('error', { message: 'threadId is required' });
          return;
        }

        // Thread'i bul
        const thread = await this.threadRepo.findById(threadId);
        if (!thread) {
          socket.emit('error', { message: 'Thread not found' });
          return;
        }

        // Kullanıcının thread'de olduğunu kontrol et
        const isParticipant =
          thread.userOneId === userId || thread.userTwoId === userId;

        if (!isParticipant) {
          socket.emit('error', { message: 'Unauthorized access to thread' });
          return;
        }

        // Thread'deki okunmamış mesajları bul ve okundu işaretle
        const unreadMessages = await this.messageRepo.findUnreadByThreadAndRecipient(
          threadId,
          userId
        );

        if (unreadMessages.length === 0) {
          socket.emit('thread_read', {
            threadId,
            readBy: userId,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Tüm okunmamış mesajları okundu işaretle
        for (const message of unreadMessages) {
          await this.messageRepo.markAsRead(message.id);

          const readEvent = {
            messageId: message.id,
            threadId,
            readBy: userId,
            timestamp: new Date().toISOString(),
          };

          // Göndericiye bildir
          this.socketHandler.sendMessageToUser(
            message.senderId,
            'message_read',
            readEvent
          );
        }

        // Thread room'una bildir
        this.socketHandler.sendToRoom(`thread:${threadId}`, 'thread_read', {
          threadId,
          readBy: userId,
          timestamp: new Date().toISOString(),
        });

        // Onay gönder
        socket.emit('thread_read', {
          threadId,
          readBy: userId,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Thread ${threadId} marked as read by ${userId} (${unreadMessages.length} messages)`
        );
      } catch (error: any) {
        logger.error('Error in mark_thread_read handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to mark thread as read',
        });
      }
    });

    // Join thread room
    socket.on('join_thread', async (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          socket.emit('error', { message: 'threadId is required' });
          return;
        }

        // Thread erişim kontrolü
        const thread = await this.threadRepo.findById(threadId);
        if (!thread) {
          socket.emit('thread_join_error', {
            threadId,
            error: 'Thread not found'
          });
          return;
        }

        const isParticipant =
          thread.userOneId === userId || thread.userTwoId === userId;

        if (!isParticipant) {
          socket.emit('thread_join_error', {
            threadId,
            error: 'Access denied'
          });
          return;
        }

        // Socket room'a join et
        socket.join(`thread:${threadId}`);

        socket.emit('thread_joined', {
          threadId,
          userId
        });

        logger.info(`User ${userId} joined thread ${threadId}`);
      } catch (error: any) {
        logger.error('Error in join_thread handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to join thread',
        });
      }
    });

    // Leave thread room
    socket.on('leave_thread', (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          socket.emit('error', { message: 'threadId is required' });
          return;
        }

        socket.leave(`thread:${threadId}`);

        // Clear typing timeout if exists
        const typingKey = `${userId}-${threadId}`;
        if (this.typingTimeouts.has(typingKey)) {
          clearTimeout(this.typingTimeouts.get(typingKey)!);
          this.typingTimeouts.delete(typingKey);
        }

        socket.emit('thread_left', {
          threadId,
          userId
        });

        logger.info(`User ${userId} left thread ${threadId}`);
      } catch (error: any) {
        logger.error('Error in leave_thread handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to leave thread',
        });
      }
    });

    // Start typing
    socket.on('start_typing', (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          socket.emit('error', { message: 'threadId is required' });
          return;
        }

        const typingKey = `${userId}-${threadId}`;

        // Clear existing timeout
        if (this.typingTimeouts.has(typingKey)) {
          clearTimeout(this.typingTimeouts.get(typingKey)!);
        }

        // Emit typing event to other users in thread
        socket.to(`thread:${threadId}`).emit('user_typing', {
          threadId,
          userId,
          timestamp: new Date().toISOString()
        });

        // Auto-stop after 3 seconds
        const timeout = setTimeout(() => {
          socket.to(`thread:${threadId}`).emit('user_stopped_typing', {
            threadId,
            userId,
            timestamp: new Date().toISOString()
          });
          this.typingTimeouts.delete(typingKey);
        }, 3000);

        this.typingTimeouts.set(typingKey, timeout);
      } catch (error: any) {
        logger.error('Error in start_typing handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to start typing',
        });
      }
    });

    // Stop typing
    socket.on('stop_typing', (data: { threadId: string }) => {
      try {
        const { threadId } = data;

        if (!threadId) {
          socket.emit('error', { message: 'threadId is required' });
          return;
        }

        const typingKey = `${userId}-${threadId}`;

        // Clear timeout
        if (this.typingTimeouts.has(typingKey)) {
          clearTimeout(this.typingTimeouts.get(typingKey)!);
          this.typingTimeouts.delete(typingKey);
        }

        socket.to(`thread:${threadId}`).emit('user_stopped_typing', {
          threadId,
          userId,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        logger.error('Error in stop_typing handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to stop typing',
        });
      }
    });

    // Edit message
    socket.on('edit_message', async (data: { messageId: string; message: string }) => {
      try {
        const { messageId, message } = data;

        if (!messageId || !message) {
          socket.emit('error', {
            message: 'messageId and message are required',
          });
          return;
        }

        if (message.trim().length === 0) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        await this.messagingService.editMessage(messageId, userId, message);

        logger.info(`Message edited via socket: ${messageId} by ${userId}`);
      } catch (error: any) {
        logger.error('Error in edit_message handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to edit message',
        });
      }
    });

    // Delete message
    socket.on('delete_message', async (data: { messageId: string }) => {
      try {
        const { messageId } = data;

        if (!messageId) {
          socket.emit('error', { message: 'messageId is required' });
          return;
        }

        await this.messagingService.deleteMessage(messageId, userId);

        logger.info(`Message deleted via socket: ${messageId} by ${userId}`);
      } catch (error: any) {
        logger.error('Error in delete_message handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to delete message',
        });
      }
    });

    // Add reaction
    socket.on('add_reaction', async (data: { messageId: string; emoji: string }) => {
      try {
        const { messageId, emoji } = data;

        if (!messageId || !emoji) {
          socket.emit('error', {
            message: 'messageId and emoji are required',
          });
          return;
        }

        if (emoji.trim().length === 0) {
          socket.emit('error', { message: 'Emoji cannot be empty' });
          return;
        }

        await this.messagingService.addReaction(messageId, userId, emoji.trim());

        logger.info(`Reaction added via socket: ${emoji} to message ${messageId} by ${userId}`);
      } catch (error: any) {
        logger.error('Error in add_reaction handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to add reaction',
        });
      }
    });

    // Remove reaction
    socket.on('remove_reaction', async (data: { messageId: string; emoji: string }) => {
      try {
        const { messageId, emoji } = data;

        if (!messageId || !emoji) {
          socket.emit('error', {
            message: 'messageId and emoji are required',
          });
          return;
        }

        await this.messagingService.removeReaction(messageId, userId, emoji.trim());

        logger.info(`Reaction removed via socket: ${emoji} from message ${messageId} by ${userId}`);
      } catch (error: any) {
        logger.error('Error in remove_reaction handler:', error);
        socket.emit('error', {
          message: error.message || 'Failed to remove reaction',
        });
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      // Clear all typing timeouts for this socket
      for (const [key, timeout] of this.typingTimeouts.entries()) {
        if (key.startsWith(`${userId}-`)) {
          clearTimeout(timeout);
          this.typingTimeouts.delete(key);
        }
      }
    });
  }
}

