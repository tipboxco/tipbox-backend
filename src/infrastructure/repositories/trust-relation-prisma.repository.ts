import { TrustRelation } from '../../domain/user/trust-relation.entity';
import { getPrisma } from './prisma.client';
import { TrustBackfillScheduler } from '../scheduler/trust-backfill.scheduler';
import logger from '../logger/logger';

// Singleton scheduler instance (her repository instance'ında yeni oluşturulmasın)
let trustBackfillSchedulerInstance: TrustBackfillScheduler | null = null;

export class TrustRelationPrismaRepository {
  private prisma = getPrisma();
  private trustBackfillScheduler: TrustBackfillScheduler;

  constructor() {
    // Singleton pattern - tek instance kullan
    if (!trustBackfillSchedulerInstance) {
      trustBackfillSchedulerInstance = new TrustBackfillScheduler();
    }
    this.trustBackfillScheduler = trustBackfillSchedulerInstance;
  }

  async findById(id: string): Promise<TrustRelation | null> {
    const relation = await this.prisma.trustRelation.findUnique({ where: { id } });
    return relation ? this.toDomain(relation) : null;
  }

    async findByUsers(trusterId: string, trustedUserId: string): Promise<TrustRelation | null> {
    const relation = await this.prisma.trustRelation.findUnique({
      where: {
        trusterId_trustedUserId: {
          trusterId: String(trusterId),
          trustedUserId: String(trustedUserId)
        }
      }
    });
    return relation ? this.toDomain(relation) : null;
  }

  async findByTrusterUserId(trusterId: string): Promise<TrustRelation[]> {
    const relations = await this.prisma.trustRelation.findMany({
      where: { trusterId: String(trusterId) },
      orderBy: { createdAt: 'desc' }
    });
    return relations.map(relation => this.toDomain(relation));
  }

  async findByTrustedUserId(trustedUserId: string): Promise<TrustRelation[]> {
    const relations = await this.prisma.trustRelation.findMany({
      where: { trustedUserId: String(trustedUserId) },
      orderBy: { createdAt: 'desc' }
    });
    return relations.map(relation => this.toDomain(relation));
  }

  async create(trusterId: string, trustedUserId: string): Promise<TrustRelation> {
    const relation = await this.prisma.trustRelation.create({
      data: {
        trusterId: String(trusterId),
        trustedUserId: String(trustedUserId)
      }
    });

    // Increment truster's trustCount
    await this.prisma.profile.updateMany({
      where: { userId: String(trusterId) },
      data: {
        trustCount: {
          increment: 1
        }
      } as any
    });

    // Increment trusted user's trusterCount
    await this.prisma.profile.updateMany({
      where: { userId: String(trustedUserId) },
      data: {
        trusterCount: {
          increment: 1
        }
      } as any
    });

    // 🚀 EVENT: Trust backfill job'ı kuyruğa ekle (async - bloke etmez)
    logger.info({ 
      message: 'Queueing trust backfill job', 
      trusterId: String(trusterId), 
      trustedUserId: String(trustedUserId) 
    });
    
    this.trustBackfillScheduler.queueTrustBackfill(
      String(trusterId), 
      String(trustedUserId),
      14 // 14 günlük geçmiş
    ).then((jobId) => {
      logger.info({ message: 'Trust backfill job queued successfully', jobId, trusterId, trustedUserId });
    }).catch((err) => {
      logger.warn({ 
        message: 'Failed to queue trust backfill job', 
        trusterId, 
        trustedUserId, 
        error: err.message 
      });
    });

    return this.toDomain(relation);
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Get relation to get trusterId and trustedUserId before deleting
      const relation = await this.prisma.trustRelation.findUnique({
        where: { id },
        select: { trusterId: true, trustedUserId: true }
      });

      if (!relation) return false;

      await this.prisma.trustRelation.delete({ where: { id } });

      // Decrement truster's trustCount
      await this.prisma.profile.updateMany({
        where: { userId: relation.trusterId },
        data: {
          trustCount: {
            increment: -1
          }
        } as any
      });

      // Decrement trusted user's trusterCount
      await this.prisma.profile.updateMany({
        where: { userId: relation.trustedUserId },
        data: {
          trusterCount: {
            increment: -1
          }
        } as any
      });

      return true;
    } catch {
      return false;
    }
  }

      async deleteByUsers(trusterId: string, trustedUserId: string): Promise<boolean> {
    try {
      const trusterIdStr = String(trusterId);
      const trustedUserIdStr = String(trustedUserId);

      await this.prisma.trustRelation.delete({
        where: {
          trusterId_trustedUserId: {
            trusterId: trusterIdStr,
            trustedUserId: trustedUserIdStr
          }
        }
      });

      // Decrement truster's trustCount
      await this.prisma.profile.updateMany({
        where: { userId: trusterIdStr },
        data: {
          trustCount: {
            increment: -1
          }
        } as any
      });

      // Decrement trusted user's trusterCount
      await this.prisma.profile.updateMany({
        where: { userId: trustedUserIdStr },
        data: {
          trusterCount: {
            increment: -1
          }
        } as any
      });

      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<TrustRelation[]> {
    const relations = await this.prisma.trustRelation.findMany();
    return relations.map(relation => this.toDomain(relation));
  }

  private toDomain(prismaRelation: any): TrustRelation {
    return new TrustRelation(
      prismaRelation.id,
      prismaRelation.trusterId,
      prismaRelation.trustedUserId,
      prismaRelation.createdAt,
      prismaRelation.updatedAt
    );
  }
}