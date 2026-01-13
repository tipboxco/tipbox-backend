import { ContentCollection } from '../../domain/content/content-collection.entity';
import { getPrisma } from './prisma.client';

export class ContentCollectionPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<ContentCollection | null> {
    const collection = await this.prisma.contentCollection.findUnique({ 
      where: { id },
      include: {
        user: true
      }
    });
    return collection ? this.toDomain(collection) : null;
  }

  async findByUserId(userId: string): Promise<ContentCollection[]> {
    const collections = await this.prisma.contentCollection.findMany({
      where: { userId },
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return collections.map(collection => this.toDomain(collection));
  }

  async findByName(userId: string, name: string): Promise<ContentCollection | null> {
    const collection = await this.prisma.contentCollection.findFirst({
      where: { 
        userId,
        name 
      },
      include: {
        user: true
      }
    });
    return collection ? this.toDomain(collection) : null;
  }

  async findAllCollections(): Promise<ContentCollection[]> {
    const collections = await this.prisma.contentCollection.findMany({
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return collections.map(collection => this.toDomain(collection));
  }

  async create(
    userId: string,
    name: string,
    description?: string
  ): Promise<ContentCollection> {
    const collection = await this.prisma.contentCollection.create({
      data: {
        userId,
        name,
        description
      },
      include: {
        user: true
      }
    });
    return this.toDomain(collection);
  }

  async update(id: string, data: { 
    name?: string;
    description?: string;
  }): Promise<ContentCollection | null> {
    const collection = await this.prisma.contentCollection.update({
      where: { id },
      data,
      include: {
        user: true
      }
    });
    return collection ? this.toDomain(collection) : null;
  }



  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.contentCollection.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }



  async list(): Promise<ContentCollection[]> {
    const collections = await this.prisma.contentCollection.findMany({
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return collections.map(collection => this.toDomain(collection));
  }

  private toDomain(prismaCollection: any): ContentCollection {
    return new ContentCollection(
      prismaCollection.id,
      prismaCollection.userId,
      prismaCollection.name,
      prismaCollection.description,
      prismaCollection.createdAt,
      prismaCollection.updatedAt
    );
  }
}