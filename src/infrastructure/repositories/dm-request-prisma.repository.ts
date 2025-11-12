import { PrismaClient, Prisma } from '@prisma/client';
import { DMRequest } from '../../domain/messaging/dm-request.entity';
import { DMRequestStatus } from '../../domain/messaging/dm-request-status.enum';
import { SupportType as DomainSupportType } from '../../domain/messaging/support-type.enum';

// SupportType will be available from Prisma after TypeScript server restart
type PrismaSupportType = 'GENERAL' | 'TECHNICAL' | 'PRODUCT';

const DM_REQUEST_INCLUDE = {
  fromUser: {
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
  toUser: {
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
} satisfies Prisma.DMRequestInclude;

type DMRequestWithRelations = Prisma.DMRequestGetPayload<{
  include: typeof DM_REQUEST_INCLUDE;
}>;

export class DMRequestPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<DMRequest | null> {
    const request = await this.prisma.dMRequest.findUnique({
      where: { id },
      include: DM_REQUEST_INCLUDE,
    });
    return request ? this.toDomain(request) : null;
  }

  async findByUserId(userId: string): Promise<DMRequestWithRelations[]> {
    const requests = await this.prisma.dMRequest.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
      include: DM_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return requests;
  }

  async findSupportRequestsByUserId(
    userId: string,
    options: { status?: string; search?: string; limit?: number } = {}
  ): Promise<DMRequestWithRelations[]> {
    const where: Prisma.DMRequestWhereInput = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
      ],
    };

    // Only include requests with description (support requests)
    // NOTE: Search is handled at service level to include user name, title, and description
    // Repository level search only filters by description, which is too restrictive
    where.description = { not: null };

    // Filter by status (DMRequestStatus)
    if (options.status) {
      where.status = options.status as DMRequestStatus;
    }

    const requests = await this.prisma.dMRequest.findMany({
      where,
      include: DM_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }

  async create(data: {
    fromUserId: string;
    toUserId: string;
    status?: DMRequestStatus;
    type?: PrismaSupportType | DomainSupportType | string;
    amount?: number;
    description?: string | null;
  }): Promise<DMRequest> {
    // Map string or domain enum to Prisma SupportType enum
    let supportType: PrismaSupportType = 'GENERAL';
    if (data.type) {
      if (typeof data.type === 'string') {
        const upperType = data.type.toUpperCase();
        // Validate and map to Prisma enum
        if (upperType === 'GENERAL' || upperType === 'TECHNICAL' || upperType === 'PRODUCT') {
          supportType = upperType as PrismaSupportType;
        }
      } else {
        // Domain enum value, convert to string
        supportType = data.type as PrismaSupportType;
      }
    }

    const request = await this.prisma.dMRequest.create({
      data: {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        status: data.status || DMRequestStatus.PENDING,
        type: supportType as any, // TypeScript will recognize after server restart
        amount: data.amount ?? 0,
        description: data.description || null,
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any, // TypeScript will recognize after server restart
      include: DM_REQUEST_INCLUDE,
    });
    return this.toDomain(request);
  }

  async update(id: string, data: {
    status?: DMRequestStatus;
    description?: string | null;
    respondedAt?: Date | null;
  }): Promise<DMRequest | null> {
    try {
      const request = await this.prisma.dMRequest.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: DM_REQUEST_INCLUDE,
      });
      return this.toDomain(request);
    } catch {
      return null;
    }
  }

  private toDomain(prismaRequest: DMRequestWithRelations): DMRequest {
    // Map Prisma SupportType to domain SupportType
    // Type assertion needed until TypeScript picks up the updated Prisma types
    const prismaRequestWithType = prismaRequest as DMRequestWithRelations & { type: PrismaSupportType; amount: number | Prisma.Decimal };
    const prismaType = prismaRequestWithType.type;
    const supportType: DomainSupportType = 
      prismaType === 'GENERAL' || prismaType === 'TECHNICAL' || prismaType === 'PRODUCT'
        ? (prismaType as DomainSupportType)
        : DomainSupportType.GENERAL;

    // Convert amount (may be Decimal) to number
    const amount = typeof prismaRequestWithType.amount === 'number' 
      ? prismaRequestWithType.amount 
      : Number(prismaRequestWithType.amount) || 0;

    return new DMRequest(
      prismaRequest.id,
      prismaRequest.fromUserId,
      prismaRequest.toUserId,
      prismaRequest.status as DMRequestStatus,
      supportType,
      amount,
      prismaRequest.description,
      prismaRequest.sentAt,
      prismaRequest.respondedAt,
      prismaRequest.createdAt,
      prismaRequest.updatedAt
    );
  }
}

