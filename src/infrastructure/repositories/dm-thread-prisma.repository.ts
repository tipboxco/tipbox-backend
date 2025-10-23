import { PrismaClient } from '@prisma/client';
import { DMThread } from '../../domain/messaging/dm-thread.entity';

export class DMThreadPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<DMThread | null> {
    const thread = await this.prisma.dMThread.findUnique({ 
      where: { id },
      include: {
        userOne: true,
        userTwo: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    return thread ? this.toDomain(thread) : null;
  }

  async findByUserId(userId: number): Promise<DMThread[]> {
    const threads = await this.prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: userId },
          { userTwoId: userId }
        ]
      },
      include: {
        userOne: true,
        userTwo: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return threads.map(thread => this.toDomain(thread));
  }

  async findByParticipants(userOneId: number, userTwoId: number): Promise<DMThread | null> {
    const thread = await this.prisma.dMThread.findFirst({
      where: {
        OR: [
          {
            userOneId,
            userTwoId
          },
          {
            userOneId: userTwoId,
            userTwoId: userOneId
          }
        ]
      },
      include: {
        userOne: true,
        userTwo: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    return thread ? this.toDomain(thread) : null;
  }

  async create(data: Partial<DMThread>): Promise<DMThread> {
    const thread = await this.prisma.dMThread.create({
      data: {
        userOneId: data.userOneId!,
        userTwoId: data.userTwoId!,
        isActive: data.isActive || true,
        startedAt: data.startedAt || new Date(),
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
      },
      include: {
        userOne: true,
        userTwo: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    return this.toDomain(thread);
  }

  async update(id: number, data: Partial<DMThread>): Promise<DMThread | null> {
    try {
      const thread = await this.prisma.dMThread.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          userOne: true,
          userTwo: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });
      return this.toDomain(thread);
    } catch {
      return null;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.dMThread.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getThreadCountByUserId(userId: number): Promise<number> {
    return this.prisma.dMThread.count({
      where: {
        OR: [
          { userOneId: userId },
          { userTwoId: userId }
        ]
      }
    });
  }

  async getActiveThreadsCount(): Promise<number> {
    // Son 30 gün içinde mesaj alışverişi olan thread sayısı
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.dMThread.count({
      where: {
        updatedAt: {
          gte: thirtyDaysAgo
        }
      }
    });
  }

  private toDomain(prismaThread: any): DMThread {
    return new DMThread(
      prismaThread.id,
      prismaThread.userOneId,
      prismaThread.userTwoId,
      prismaThread.isActive,
      prismaThread.startedAt,
      prismaThread.createdAt,
      prismaThread.updatedAt
    );
  }
}
