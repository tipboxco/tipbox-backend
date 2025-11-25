import { PrismaClient, Prisma } from '@prisma/client';
import { DMThread } from '../../domain/messaging/dm-thread.entity';

const THREAD_INCLUDE = {
  messages: {
    orderBy: { sentAt: 'desc' as const },
    take: 1,
  },
  userOne: {
    include: {
      profile: true,
      titles: {
        orderBy: { earnedAt: 'desc' as const },
        take: 1,
      },
      avatars: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
  userTwo: {
    include: {
      profile: true,
      titles: {
        orderBy: { earnedAt: 'desc' as const },
        take: 1,
      },
      avatars: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
} as const;

// Prisma payload for thread with all relations we include in this repository
type ThreadWithRelations = Prisma.DMThreadGetPayload<{
  include: typeof THREAD_INCLUDE;
}>;

export class DMThreadPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<DMThread | null> {
    const thread = await this.prisma.dMThread.findUnique({
      where: { id },
      include: THREAD_INCLUDE,
    });
    return thread ? this.toDomain(thread) : null;
  }

  async findByUserId(userId: string): Promise<DMThread[]> {
    const threads = await this.prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: String(userId) },
          { userTwoId: String(userId) },
        ],
        isSupportThread: false,
      } as any,
      include: THREAD_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return threads.map((thread) => this.toDomain(thread));
  }

  async findDetailedByUserId(
    userId: string,
    options: { search?: string; unreadOnly?: boolean; limit?: number } = {},
  ): Promise<ThreadWithRelations[]> {
    const userIdStr = String(userId);

    const threads = await this.prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: userIdStr },
          { userTwoId: userIdStr },
        ],
        isSupportThread: false,
      } as any,
      include: THREAD_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: options.limit ?? 50,
    }) as ThreadWithRelations[];

    let filteredThreads = threads;

    if (options.unreadOnly) {
      filteredThreads = filteredThreads.filter((thread) => {
        const unreadCount = thread.userOneId === userIdStr ? thread.unreadCountUserOne : thread.unreadCountUserTwo;
        return unreadCount > 0;
      });
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filteredThreads = filteredThreads.filter((thread) => {
        const counterpart = thread.userOneId === userIdStr ? thread.userTwo : thread.userOne;
        const lastMessage = thread.messages[0];
        const values = [
          counterpart?.profile?.displayName,
          counterpart?.profile?.userName,
          counterpart?.email,
          counterpart?.titles?.[0]?.title,
          lastMessage?.message,
        ];

        return values.some((value) => value?.toLowerCase().includes(searchLower));
      });
    }

    return filteredThreads;
  }

  /**
   * Get thread activity map for a user
   * Returns a map of otherUserId -> { isActive: boolean }
   * Used to determine support request status
   */
  async getThreadActivityMap(userId: string): Promise<Map<string, { isActive: boolean }>> {
    const threads = await this.prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: userId },
          { userTwoId: userId },
        ],
        isSupportThread: false,
      } as any,
      select: {
        userOneId: true,
        userTwoId: true,
        isActive: true,
      },
    });

    const threadMap = new Map<string, { isActive: boolean }>();
    for (const thread of threads) {
      const otherUserId = thread.userOneId === userId 
        ? thread.userTwoId 
        : thread.userOneId;
      threadMap.set(otherUserId, { isActive: thread.isActive });
    }

    return threadMap;
  }

  async findByParticipants(userOneId: number, userTwoId: number): Promise<DMThread | null> {
    const thread = await this.prisma.dMThread.findFirst({
      where: {
        OR: [
          {
            userOneId: String(userOneId),
            userTwoId: String(userTwoId),
          },
          {
            userOneId: String(userTwoId),
            userTwoId: String(userOneId),
          },
        ],
      },
      include: THREAD_INCLUDE,
    });
    return thread ? this.toDomain(thread) : null;
  }

  async create(data: Partial<DMThread>): Promise<DMThread> {
    const thread = await this.prisma.dMThread.create({
      data: {
        userOneId: String(data.userOneId!),
        userTwoId: String(data.userTwoId!),
        isActive: data.isActive ?? true,
        isSupportThread: data.isSupportThread ?? false,
        startedAt: data.startedAt ?? new Date(),
        createdAt: data.createdAt ?? new Date(),
        updatedAt: data.updatedAt ?? new Date(),
      } as any,
      include: THREAD_INCLUDE,
    });
    return this.toDomain(thread);
  }

  async update(id: string, data: Partial<DMThread>): Promise<DMThread | null> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }
      
      const thread = await this.prisma.dMThread.update({
        where: { id: String(id) },
        data: updateData,
        include: THREAD_INCLUDE,
      });
      return this.toDomain(thread);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
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
          { userOneId: String(userId) },
          { userTwoId: String(userId) },
        ],
      },
    });
  }

  async getActiveThreadsCount(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.dMThread.count({
      where: {
        updatedAt: {
          gte: thirtyDaysAgo,
        },
      },
    });
  }

  private toDomain(prismaThread: any): DMThread {
    return new DMThread(
      prismaThread.id,
      prismaThread.userOneId,
      prismaThread.userTwoId,
      prismaThread.isActive,
      prismaThread.isSupportThread ?? false,
      prismaThread.startedAt,
      prismaThread.createdAt,
      prismaThread.updatedAt,
    );
  }
}
