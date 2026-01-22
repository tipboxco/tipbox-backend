import { DMMessage } from '../../domain/messaging/dm-message.entity';
import { getPrisma } from './prisma.client';

export class DmMessagePrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<DMMessage | null> {
    const message = await this.prisma.dMMessage.findUnique({ 
      where: { id },
      include: {
        sender: true,
        thread: true
      }
    });
    return message ? this.toDomain(message) : null;
  }

  async findByThreadId(threadId: string, limit = 50, offset = 0): Promise<DMMessage[]> {
    const messages = await this.prisma.dMMessage.findMany({
      where: { threadId },
      include: {
        sender: true,
        thread: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
    return messages.map(message => this.toDomain(message));
  }

  async findBySenderId(senderId: number): Promise<DMMessage[]> {
    const messages = await this.prisma.dMMessage.findMany({
      where: { senderId: String(senderId) },
      include: {
        sender: true,
        thread: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return messages.map(message => this.toDomain(message));
  }

  async create(data: Partial<DMMessage>): Promise<DMMessage> {
    const threadIdStr = String(data.threadId!);
    const senderIdStr = String(data.senderId!);

    // Get thread to determine which user's unread count to increment
    const thread = await this.prisma.dMThread.findUnique({
      where: { id: threadIdStr },
      select: { userOneId: true, userTwoId: true }
    });

    const message = await this.prisma.dMMessage.create({
      data: {
        threadId: threadIdStr,
        senderId: senderIdStr,
        message: data.message!,
        isRead: data.isRead || false,
        sentAt: data.sentAt || new Date(),
        createdAt: data.createdAt || new Date(),
        context: (data as any).context || 'DM', // Context field'ı entity'de yok ama Prisma'da var
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        thumbnailUrl: data.thumbnailUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        caption: data.caption,
        replyToMessageId: data.replyToMessageId,
        status: data.status || 'sent',
        deliveredAt: data.deliveredAt,
        readAt: data.readAt,
        isDeleted: data.isDeleted || false,
        deletedAt: data.deletedAt,
        deletedBy: data.deletedBy,
        isEdited: data.isEdited || false,
        editedAt: data.editedAt,
      },
      include: {
        sender: true,
        thread: true
      }
    });

    // Update thread's last message
    await this.prisma.dMThread.update({
      where: { id: threadIdStr },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.sentAt,
        updatedAt: new Date(),
      }
    });

    // Increment unread count for the other user (not the sender)
    if (thread && !data.isRead) {
      if (thread.userOneId === senderIdStr) {
        // Sender is userOne, increment userTwo's unread count
        await this.prisma.dMThread.update({
          where: { id: threadIdStr },
          data: {
            unreadCountUserTwo: {
              increment: 1
            }
          } as any
        });
      } else if (thread.userTwoId === senderIdStr) {
        // Sender is userTwo, increment userOne's unread count
        await this.prisma.dMThread.update({
          where: { id: threadIdStr },
          data: {
            unreadCountUserOne: {
              increment: 1
            }
          } as any
        });
      }
    }

    return this.toDomain(message);
  }

  async update(id: string, data: Partial<DMMessage>): Promise<DMMessage | null> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      if (data.message !== undefined) updateData.message = data.message;
      if (data.isRead !== undefined) updateData.isRead = data.isRead;
      if (data.sentAt !== undefined) updateData.sentAt = data.sentAt;
      
      const message = await this.prisma.dMMessage.update({
        where: { id },
        data: updateData,
        include: {
          sender: true,
          thread: true
        }
      });
      return this.toDomain(message);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.dMMessage.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getUnreadCountByUserId(userId: string): Promise<number> {
    const userIdStr = String(userId);
    // Kullanıcının katıldığı thread'lerdeki okunmamış mesaj sayısını al
    const threads = await this.prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: userIdStr },
          { userTwoId: userIdStr }
        ]
      }
    });

    const threadIds = threads.map(thread => thread.id);

    return this.prisma.dMMessage.count({
      where: {
        threadId: { in: threadIds },
        isRead: false,
        senderId: { not: userIdStr } // Kendi gönderdiği mesajları sayma
      }
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.prisma.dMMessage.update({
      where: { id: messageId },
      data: {
        isRead: true,
        updatedAt: new Date(),
      },
    });
  }

  async findUnreadByThreadAndRecipient(threadId: string, recipientId: string): Promise<DMMessage[]> {
    const messages = await this.prisma.dMMessage.findMany({
      where: {
        threadId,
        senderId: { not: recipientId },
        isRead: false,
      },
      include: {
        sender: true,
        thread: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(message => this.toDomain(message));
  }

  async markAllAsReadInThread(threadId: string, userId: string): Promise<void> {
    const threadIdStr = threadId;
    const userIdStr = userId;

    // Get thread to determine which user's unread count to reset
    const thread = await this.prisma.dMThread.findUnique({
      where: { id: threadIdStr },
      select: { userOneId: true, userTwoId: true }
    });

    // Count unread messages before marking as read
    const unreadCount = await this.prisma.dMMessage.count({
      where: {
        threadId: threadIdStr,
        senderId: { not: userIdStr },
        isRead: false
      }
    });

    await this.prisma.dMMessage.updateMany({
      where: {
        threadId: threadIdStr,
        senderId: { not: userIdStr },
        isRead: false
      },
      data: {
        isRead: true,
        updatedAt: new Date()
      }
    });

    // Reset unread count for the user who marked messages as read
    // ÖNEMLİ: Bu güncelleme transaction içinde yapılmalı ki GET /inbox hemen güncel veriyi döndürsün
    if (thread && unreadCount > 0) {
      if (thread.userOneId === userIdStr) {
        // UserOne marked as read, reset userOne's unread count
        await this.prisma.dMThread.update({
          where: { id: threadIdStr },
          data: {
            unreadCountUserOne: 0,
            updatedAt: new Date(), // updatedAt'i güncelle ki thread listesinde en üste çıksın
          } as any
        });
      } else if (thread.userTwoId === userIdStr) {
        // UserTwo marked as read, reset userTwo's unread count
        await this.prisma.dMThread.update({
          where: { id: threadIdStr },
          data: {
            unreadCountUserTwo: 0,
            updatedAt: new Date(), // updatedAt'i güncelle ki thread listesinde en üste çıksın
          } as any
        });
      }
    }
  }

  async findByIdWithReactions(id: string): Promise<DMMessage | null> {
    const message = await this.prisma.dMMessage.findUnique({ 
      where: { id },
      include: {
        sender: true,
        thread: true,
        reactions: {
          include: {
            user: true
          }
        }
      }
    });
    return message ? this.toDomain(message) : null;
  }

  async markAsDeleted(messageId: string, deletedBy: string): Promise<DMMessage | null> {
    try {
      const message = await this.prisma.dMMessage.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
          message: 'Bu mesaj silindi',
          updatedAt: new Date(),
        },
        include: {
          sender: true,
          thread: true
        }
      });
      return this.toDomain(message);
    } catch {
      return null;
    }
  }

  async updateMessage(messageId: string, newMessage: string): Promise<DMMessage | null> {
    try {
      const message = await this.prisma.dMMessage.update({
        where: { id: messageId },
        data: {
          message: newMessage,
          isEdited: true,
          editedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          sender: true,
          thread: true
        }
      });
      return this.toDomain(message);
    } catch {
      return null;
    }
  }

  async findByThreadWithPagination(
    threadId: string, 
    limit: number = 50, 
    cursor?: Date,
    isDeleted: boolean = false
  ): Promise<{ messages: DMMessage[]; hasMore: boolean; nextCursor?: Date }> {
    const whereClause: any = {
      threadId,
      isDeleted
    };

    if (cursor) {
      whereClause.sentAt = {
        lt: cursor
      };
    }

    const messages = await this.prisma.dMMessage.findMany({
      where: whereClause,
      include: {
        sender: true,
        thread: true
      },
      orderBy: { sentAt: 'desc' },
      take: limit + 1
    });

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore && resultMessages.length > 0 
      ? resultMessages[resultMessages.length - 1].sentAt 
      : undefined;

    return {
      messages: resultMessages.reverse().map(m => this.toDomain(m)),
      hasMore,
      nextCursor
    };
  }

  async searchMessages(threadId: string, query: string, limit: number = 50, offset: number = 0): Promise<DMMessage[]> {
    const messages = await this.prisma.dMMessage.findMany({
      where: {
        threadId,
        isDeleted: false,
        message: {
          contains: query,
          mode: 'insensitive'
        }
      },
      include: {
        sender: true,
        thread: true
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip: offset
    });
    return messages.map(m => this.toDomain(m));
  }

  async markAsDelivered(messageId: string): Promise<void> {
    await this.prisma.dMMessage.update({
      where: { id: messageId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async markAsReadWithReceipt(messageId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Update message status
      await tx.dMMessage.update({
        where: { id: messageId },
        data: {
          isRead: true,
          status: 'read',
          readAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create read receipt
      await tx.messageReadReceipt.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId
          }
        },
        create: {
          messageId,
          userId,
          readAt: new Date(),
        },
        update: {
          readAt: new Date(),
        },
      });
    });
  }

  private toDomain(prismaMessage: any): DMMessage {
    return new DMMessage(
      prismaMessage.id,
      prismaMessage.threadId,
      prismaMessage.senderId,
      prismaMessage.message,
      prismaMessage.sentAt,
      prismaMessage.isRead,
      prismaMessage.createdAt,
      prismaMessage.updatedAt,
      prismaMessage.mediaUrl,
      prismaMessage.mediaType,
      prismaMessage.thumbnailUrl,
      prismaMessage.fileName,
      prismaMessage.fileSize,
      prismaMessage.caption,
      prismaMessage.replyToMessageId,
      prismaMessage.status,
      prismaMessage.deliveredAt,
      prismaMessage.readAt,
      prismaMessage.isDeleted,
      prismaMessage.deletedAt,
      prismaMessage.deletedBy,
      prismaMessage.isEdited,
      prismaMessage.editedAt
    );
  }
}
