import { TrustRelation } from '../../domain/user/trust-relation.entity';
import { getPrisma } from './prisma.client';

export class TrustRelationPrismaRepository {
  private prisma = getPrisma();

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