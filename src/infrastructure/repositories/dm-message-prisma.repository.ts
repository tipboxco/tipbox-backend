import { PrismaClient } from '@prisma/client';
import { DMMessage } from '../../domain/messaging/dm-message.entity';

export class DmMessagePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<DMMessage | null> {
    const message = await this.prisma.dMMessage.findUnique({ 
      where: { id: String(id) },
      include: {
        sender: true,
        thread: true
      }
    });
    return message ? this.toDomain(message) : null;
  }

  async findByThreadId(threadId: number, limit = 50, offset = 0): Promise<DMMessage[]> {
    const messages = await this.prisma.dMMessage.findMany({
      where: { threadId: String(threadId) },
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
      },
      include: {
        sender: true,
        thread: true
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

  async update(id: number, data: Partial<DMMessage>): Promise<DMMessage | null> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      if (data.message !== undefined) updateData.message = data.message;
      if (data.isRead !== undefined) updateData.isRead = data.isRead;
      if (data.sentAt !== undefined) updateData.sentAt = data.sentAt;
      
      const message = await this.prisma.dMMessage.update({
        where: { id: String(id) },
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

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.dMMessage.delete({ where: { id: String(id) } });
      return true;
    } catch {
      return false;
    }
  }

  async getUnreadCountByUserId(userId: number): Promise<number> {
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

  async markAllAsReadInThread(threadId: number, userId: number): Promise<void> {
    const threadIdStr = String(threadId);
    const userIdStr = String(userId);

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
    if (thread && unreadCount > 0) {
      if (thread.userOneId === userIdStr) {
        // UserOne marked as read, reset userOne's unread count
        await this.prisma.dMThread.update({
          where: { id: threadIdStr },
          data: {
            unreadCountUserOne: 0
          } as any
        });
      } else if (thread.userTwoId === userIdStr) {
        // UserTwo marked as read, reset userTwo's unread count
        await this.prisma.dMThread.update({
          where: { id: threadIdStr },
          data: {
            unreadCountUserTwo: 0
          } as any
        });
      }
    }
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
      prismaMessage.updatedAt
    );
  }
}
