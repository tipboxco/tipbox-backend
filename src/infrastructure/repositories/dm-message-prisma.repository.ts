import { PrismaClient } from '@prisma/client';
import { DMMessage } from '../../domain/messaging/dm-message.entity';

export class DmMessagePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<DMMessage | null> {
    const message = await this.prisma.dMMessage.findUnique({ 
      where: { id },
      include: {
        sender: true,
        thread: true
      }
    });
    return message ? this.toDomain(message) : null;
  }

  async findByThreadId(threadId: number, limit = 50, offset = 0): Promise<DMMessage[]> {
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
      where: { senderId },
      include: {
        sender: true,
        thread: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return messages.map(message => this.toDomain(message));
  }

  async create(data: Partial<DMMessage>): Promise<DMMessage> {
    const message = await this.prisma.dMMessage.create({
      data: {
        threadId: data.threadId!,
        senderId: data.senderId!,
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
    return this.toDomain(message);
  }

  async update(id: number, data: Partial<DMMessage>): Promise<DMMessage | null> {
    try {
      const message = await this.prisma.dMMessage.update({
        where: { id },
        data: {
          ...data,
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

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.dMMessage.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getUnreadCountByUserId(userId: number): Promise<number> {
    // Kullanıcının katıldığı thread'lerdeki okunmamış mesaj sayısını al
    const threads = await this.prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: userId },
          { userTwoId: userId }
        ]
      }
    });

    const threadIds = threads.map(thread => thread.id);

    return this.prisma.dMMessage.count({
      where: {
        threadId: { in: threadIds },
        isRead: false,
        senderId: { not: userId } // Kendi gönderdiği mesajları sayma
      }
    });
  }

  async markAllAsReadInThread(threadId: number, userId: number): Promise<void> {
    await this.prisma.dMMessage.updateMany({
      where: {
        threadId,
        senderId: { not: userId },
        isRead: false
      },
      data: {
        isRead: true,
        updatedAt: new Date()
      }
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
      prismaMessage.updatedAt
    );
  }
}
