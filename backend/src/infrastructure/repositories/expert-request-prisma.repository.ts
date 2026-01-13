import { ExpertRequest } from '../../domain/expert/expert-request.entity';
import { getPrisma } from './prisma.client';
import { ExpertRequestStatus } from '../../domain/expert/expert-request-status.enum';

export class ExpertRequestPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<ExpertRequest | null> {
    const request = await this.prisma.expertRequest.findUnique({
      where: { id },
      include: {
        answers: true,
      },
    });
    return request ? this.toDomain(request) : null;
  }

  async findByUserId(userId: string): Promise<ExpertRequest[]> {
    const requests = await this.prisma.expertRequest.findMany({
      where: { userId },
      include: {
        answers: {
          include: {
            expertUser: {
              include: {
                profile: true,
                titles: true,
                avatars: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((request: any) => this.toDomain(request));
  }

  async create(
    userId: string,
    description: string,
    tipsAmount: number = 0,
    category?: string | null
  ): Promise<ExpertRequest> {
    const request = await this.prisma.expertRequest.create({
      data: {
        userId,
        description,
        category: category || null,
        tipsAmount,
        status: 'PENDING',
      },
    });
    return this.toDomain(request);
  }

  async update(
    id: string,
    data: {
      description?: string;
      category?: string | null;
      tipsAmount?: number;
      status?: ExpertRequestStatus;
      answeredAt?: Date | null;
    }
  ): Promise<ExpertRequest | null> {
    const request = await this.prisma.expertRequest.update({
      where: { id },
      data: {
        description: data.description,
        category: data.category !== undefined ? data.category : undefined,
        tipsAmount: data.tipsAmount,
        status: data.status as any,
        answeredAt: data.answeredAt,
      },
      include: {
        answers: true,
      },
    });
    return request ? this.toDomain(request) : null;
  }

  async updateTipsAmount(id: string, tipsAmount: number): Promise<ExpertRequest | null> {
    return this.update(id, { tipsAmount });
  }

  async findAnsweredRequests(): Promise<ExpertRequest[]> {
    const requests = await this.prisma.expertRequest.findMany({
      where: { status: 'ANSWERED' },
      include: {
        answers: {
          include: {
            expertUser: {
              include: {
                profile: true,
                titles: true,
                avatars: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { answeredAt: 'desc' },
    });
    return requests.map((request: any) => this.toDomain(request));
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.expertRequest.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(prismaRequest: any): ExpertRequest {
    return new ExpertRequest(
      prismaRequest.id,
      prismaRequest.userId,
      prismaRequest.description,
      prismaRequest.category || null,
      prismaRequest.tipsAmount,
      prismaRequest.status as ExpertRequestStatus,
      prismaRequest.answeredAt,
      prismaRequest.createdAt,
      prismaRequest.updatedAt
    );
  }
}

