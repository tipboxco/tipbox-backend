import { UserCollection } from '../../domain/user/user-collection.entity';
import { getPrisma } from './prisma.client';

export class UserCollectionPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<UserCollection | null> {
    const collection = await this.prisma.userCollection.findUnique({ where: { id } });
    return collection ? this.toDomain(collection) : null;
  }

  async findByUserId(userId: string): Promise<UserCollection[]> {
    const collections = await this.prisma.userCollection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return collections.map(collection => this.toDomain(collection));
  }

  async findByName(userId: string, name: string): Promise<UserCollection | null> {
    const collection = await this.prisma.userCollection.findFirst({
      where: { 
        userId,
        name 
      }
    });
    return collection ? this.toDomain(collection) : null;
  }

  async findAllCollections(): Promise<UserCollection[]> {
    const collections = await this.prisma.userCollection.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return collections.map(collection => this.toDomain(collection));
  }

  async create(userId: string, name: string, description?: string): Promise<UserCollection> {
    const collection = await this.prisma.userCollection.create({
      data: {
        userId,
        name,
        description
      }
    });
    return this.toDomain(collection);
  }

  async update(id: string, data: { name?: string; description?: string }): Promise<UserCollection | null> {
    const collection = await this.prisma.userCollection.update({
      where: { id },
      data
    });
    return collection ? this.toDomain(collection) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userCollection.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserCollection[]> {
    const collections = await this.prisma.userCollection.findMany();
    return collections.map(collection => this.toDomain(collection));
  }

  private toDomain(prismaCollection: any): UserCollection {
    return new UserCollection(
      prismaCollection.id,
      prismaCollection.userId,
      prismaCollection.name,
      prismaCollection.description,
      prismaCollection.createdAt,
      prismaCollection.updatedAt
    );
  }
}