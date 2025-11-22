import { PrismaClient, Prisma, DMRequestStatus as PrismaDMRequestStatus, SupportType as PrismaSupportType } from '@prisma/client';
import { DMRequest } from '../../domain/messaging/dm-request.entity';
import { DMRequestStatus } from '../../domain/messaging/dm-request-status.enum';
import { SupportType as DomainSupportType } from '../../domain/messaging/support-type.enum';
import logger from '../logger/logger';

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
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

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
    options: { status?: string | DMRequestStatus; search?: string; limit?: number } = {}
  ): Promise<DMRequestWithRelations[]> {
    const where: Prisma.DMRequestWhereInput = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
      ],
      // Only include requests with description (support requests)
      // NOTE: Search is handled at service level to include user name, title, and description
      // Repository level search only filters by description, which is too restrictive
      description: { not: null },
    };

    // Filter by status (DMRequestStatus)
    // Domain enum değerleri (PENDING, ACCEPTED, etc.) Prisma enum değerleri ile uyumludur
    if (options.status) {
      // Type-safe: Domain enum string değerleri Prisma enum değerleri ile uyumlu
      where.status = options.status as PrismaDMRequestStatus;
    }

    const requests = await this.prisma.dMRequest.findMany({
      where,
      include: DM_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
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
    let supportType: PrismaSupportType = PrismaSupportType.GENERAL;
    if (data.type) {
      if (typeof data.type === 'string') {
        const upperType = data.type.toUpperCase();
        // Validate and map to Prisma enum
        if (upperType === 'GENERAL' || upperType === 'TECHNICAL' || upperType === 'PRODUCT') {
          supportType = upperType as PrismaSupportType;
        }
      } else if (data.type in PrismaSupportType) {
        // Domain enum value, convert to Prisma enum
        supportType = data.type as PrismaSupportType;
      }
    }

    const now = new Date();
    const request = await this.prisma.dMRequest.create({
      data: {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        status: (data.status || DMRequestStatus.PENDING) as PrismaDMRequestStatus,
        type: supportType,
        amount: data.amount ?? 0,
        description: data.description || null,
        sentAt: now,
        respondedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      include: DM_REQUEST_INCLUDE,
    });
    return this.toDomain(request);
  }

  async update(id: string, data: {
    status?: DMRequestStatus;
    description?: string | null;
    respondedAt?: Date | null;
    threadId?: string | null;
    fromUserRating?: number | null;
    toUserRating?: number | null;
    closedByFromUserAt?: Date | null;
    closedByToUserAt?: Date | null;
  }): Promise<DMRequest | null> {
    try {
      const updateData: Prisma.DMRequestUpdateInput = {
        updatedAt: new Date(),
      };
      
      // Her field'ı explicit olarak ekle
      if (data.status !== undefined) {
        updateData.status = data.status as PrismaDMRequestStatus;
      }
      
      if (data.description !== undefined) {
        updateData.description = data.description;
      }
      
      if (data.respondedAt !== undefined) {
        updateData.respondedAt = data.respondedAt;
      }
      
      if (data.threadId !== undefined) {
        // threadId is a direct field in schema, but Prisma types may not include it in UpdateInput
        // Use type assertion for now - this is safe as threadId exists in the schema
        (updateData as any).threadId = data.threadId;
      }
      
      if (data.fromUserRating !== undefined) {
        updateData.fromUserRating = data.fromUserRating;
      }
      
      if (data.toUserRating !== undefined) {
        updateData.toUserRating = data.toUserRating;
      }
      
      if (data.closedByFromUserAt !== undefined) {
        updateData.closedByFromUserAt = data.closedByFromUserAt;
      }
      
      if (data.closedByToUserAt !== undefined) {
        updateData.closedByToUserAt = data.closedByToUserAt;
      }
      
      const request = await this.prisma.dMRequest.update({
        where: { id },
        data: updateData,
        include: DM_REQUEST_INCLUDE,
      });
      
      logger.info(`DMRequest ${id} updated:`, {
        status: data.status,
        threadId: data.threadId,
        hasThreadId: !!data.threadId,
      });
      
      return this.toDomain(request);
    } catch (error) {
      logger.error(`Failed to update DMRequest ${id}:`, error);
      return null;
    }
  }

  public toDomain(prismaRequest: DMRequestWithRelations): DMRequest {
    // Map Prisma SupportType to domain SupportType
    const prismaType = prismaRequest.type;
    const supportType: DomainSupportType = 
      prismaType === PrismaSupportType.GENERAL 
        ? DomainSupportType.GENERAL
        : prismaType === PrismaSupportType.TECHNICAL
        ? DomainSupportType.TECHNICAL
        : prismaType === PrismaSupportType.PRODUCT
        ? DomainSupportType.PRODUCT
        : DomainSupportType.GENERAL;

    // Convert amount (may be Decimal) to number
    const amount = typeof prismaRequest.amount === 'number' 
      ? prismaRequest.amount 
      : Number(prismaRequest.amount) || 0;

    return new DMRequest(
      prismaRequest.id,
      prismaRequest.fromUserId,
      prismaRequest.toUserId,
      prismaRequest.status as DMRequestStatus,
      supportType,
      amount,
      prismaRequest.description,
      prismaRequest.threadId ?? null,
      prismaRequest.fromUserRating ?? null,
      prismaRequest.toUserRating ?? null,
      prismaRequest.closedByFromUserAt ?? null,
      prismaRequest.closedByToUserAt ?? null,
      prismaRequest.sentAt,
      prismaRequest.respondedAt,
      prismaRequest.createdAt,
      prismaRequest.updatedAt
    );
  }
}

