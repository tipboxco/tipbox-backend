import type { MessageReadReceipt as PrismaMessageReadReceiptModel } from '@prisma/client';
import { MessageReadReceipt } from '../../domain/messaging/message-read-receipt.entity';
import { getPrisma } from './prisma.client';

export class MessageReadReceiptPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<MessageReadReceipt | null> {
    const receipt = await this.prisma.messageReadReceipt.findUnique({
      where: { id },
      include: {
        message: true,
        user: true
      }
    });
    return receipt ? this.toDomain(receipt) : null;
  }

  async findByMessageId(messageId: string): Promise<MessageReadReceipt[]> {
    const receipts = await this.prisma.messageReadReceipt.findMany({
      where: { messageId },
      include: {
        user: true
      },
      orderBy: { readAt: 'desc' }
    });
    return receipts.map(r => this.toDomain(r));
  }

  async findByUserId(userId: string): Promise<MessageReadReceipt[]> {
    const receipts = await this.prisma.messageReadReceipt.findMany({
      where: { userId },
      include: {
        message: true
      },
      orderBy: { readAt: 'desc' }
    });
    return receipts.map(r => this.toDomain(r));
  }

  async findByMessageIdAndUserId(messageId: string, userId: string): Promise<MessageReadReceipt | null> {
    const receipt = await this.prisma.messageReadReceipt.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId
        }
      },
      include: {
        message: true,
        user: true
      }
    });
    return receipt ? this.toDomain(receipt) : null;
  }

  async create(data: {
    messageId: string;
    userId: string;
    readAt?: Date;
  }): Promise<MessageReadReceipt> {
    const receipt = await this.prisma.messageReadReceipt.create({
      data: {
        messageId: data.messageId,
        userId: data.userId,
        readAt: data.readAt || new Date(),
      },
      include: {
        message: true,
        user: true
      }
    });
    return this.toDomain(receipt);
  }

  async upsert(data: {
    messageId: string;
    userId: string;
    readAt?: Date;
  }): Promise<MessageReadReceipt> {
    const receipt = await this.prisma.messageReadReceipt.upsert({
      where: {
        messageId_userId: {
          messageId: data.messageId,
          userId: data.userId
        }
      },
      create: {
        messageId: data.messageId,
        userId: data.userId,
        readAt: data.readAt || new Date(),
      },
      update: {
        readAt: data.readAt || new Date(),
      },
      include: {
        message: true,
        user: true
      }
    });
    return this.toDomain(receipt);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.messageReadReceipt.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(prismaReceipt: PrismaMessageReadReceiptModel): MessageReadReceipt {
    return new MessageReadReceipt(
      prismaReceipt.id,
      prismaReceipt.messageId,
      prismaReceipt.userId,
      prismaReceipt.readAt
    );
  }
}
