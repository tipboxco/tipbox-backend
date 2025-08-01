import { PrismaClient } from '@prisma/client';
import { TrustRelation } from '../../domain/user/trust-relation.entity';

export class TrustRelationPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<TrustRelation | null> {
    const relation = await this.prisma.trustRelation.findUnique({ where: { id } });
    return relation ? this.toDomain(relation) : null;
  }

  async findByUsers(trusterId: number, trustedUserId: number): Promise<TrustRelation | null> {
    const relation = await this.prisma.trustRelation.findUnique({
      where: {
        trusterId_trustedUserId: {
          trusterId,
          trustedUserId
        }
      }
    });
    return relation ? this.toDomain(relation) : null;
  }

  async findByTrusterUserId(trusterId: number): Promise<TrustRelation[]> {
    const relations = await this.prisma.trustRelation.findMany({
      where: { trusterId },
      orderBy: { createdAt: 'desc' }
    });
    return relations.map(relation => this.toDomain(relation));
  }

  async findByTrustedUserId(trustedUserId: number): Promise<TrustRelation[]> {
    const relations = await this.prisma.trustRelation.findMany({
      where: { trustedUserId },
      orderBy: { createdAt: 'desc' }
    });
    return relations.map(relation => this.toDomain(relation));
  }

  async create(trusterId: number, trustedUserId: number): Promise<TrustRelation> {
    const relation = await this.prisma.trustRelation.create({
      data: {
        trusterId,
        trustedUserId
      }
    });
    return this.toDomain(relation);
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.trustRelation.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByUsers(trusterId: number, trustedUserId: number): Promise<boolean> {
    try {
      await this.prisma.trustRelation.delete({
        where: {
          trusterId_trustedUserId: {
            trusterId,
            trustedUserId
          }
        }
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