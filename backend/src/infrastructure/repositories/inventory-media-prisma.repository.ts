import type { InventoryMedia as PrismaInventoryMediaModel } from '@prisma/client';
import { InventoryMedia } from '../../domain/inventory/inventory-media.entity';
import { getPrisma } from './prisma.client';

export class InventoryMediaPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<InventoryMedia | null> {
    const media = await this.prisma.inventoryMedia.findUnique({ 
      where: { id },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      }
    });
    return media ? this.toDomain(media) : null;
  }

  async findByInventoryId(inventoryId: string): Promise<InventoryMedia[]> {
    const medias = await this.prisma.inventoryMedia.findMany({
      where: { inventoryId },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return medias.map(media => this.toDomain(media));
  }


  async findByUserId(userId: string): Promise<InventoryMedia[]> {
    const medias = await this.prisma.inventoryMedia.findMany({
      where: {
        inventory: {
          userId
        }
      },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return medias.map(media => this.toDomain(media));
  }

  async create(
    inventoryId: string, 
    mediaUrl: string
  ): Promise<InventoryMedia> {
    const media = await this.prisma.inventoryMedia.create({
      data: {
        inventoryId,
        mediaUrl
      },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      }
    });
    return this.toDomain(media);
  }

  async update(id: string, data: { 
    mediaUrl?: string;
  }): Promise<InventoryMedia | null> {
    const media = await this.prisma.inventoryMedia.update({
      where: { id },
      data,
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      }
    });
    return media ? this.toDomain(media) : null;
  }



  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.inventoryMedia.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByInventoryId(inventoryId: string): Promise<boolean> {
    try {
      await this.prisma.inventoryMedia.deleteMany({
        where: { inventoryId }
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByInventoryId(inventoryId: string): Promise<number> {
    return await this.prisma.inventoryMedia.count({
      where: { inventoryId }
    });
  }


  async list(): Promise<InventoryMedia[]> {
    const medias = await this.prisma.inventoryMedia.findMany({
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return medias.map(media => this.toDomain(media));
  }

  private toDomain(prismaMedia: PrismaInventoryMediaModel): InventoryMedia {
    return new InventoryMedia(
      prismaMedia.id,
      prismaMedia.inventoryId,
      prismaMedia.mediaUrl,
      prismaMedia.uploadedAt,
      prismaMedia.createdAt,
      prismaMedia.updatedAt
    );
  }
}