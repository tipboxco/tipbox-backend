import { PrismaClient } from '@prisma/client';
import { InventoryMedia } from '../../domain/inventory/inventory-media.entity';
import { InventoryMediaType } from '../../domain/inventory/inventory-media-type.enum';

export class InventoryMediaPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<InventoryMedia | null> {
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

  async findByInventoryId(inventoryId: number): Promise<InventoryMedia[]> {
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

  async findByType(inventoryId: number, type: InventoryMediaType): Promise<InventoryMedia[]> {
    const medias = await this.prisma.inventoryMedia.findMany({
      where: { 
        inventoryId,
        type 
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

  async findImagesByInventoryId(inventoryId: number): Promise<InventoryMedia[]> {
    return this.findByType(inventoryId, InventoryMediaType.IMAGE);
  }

  async findVideosByInventoryId(inventoryId: number): Promise<InventoryMedia[]> {
    return this.findByType(inventoryId, InventoryMediaType.VIDEO);
  }

  async findByUserId(userId: number): Promise<InventoryMedia[]> {
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
    inventoryId: number, 
    mediaUrl: string, 
    type: InventoryMediaType
  ): Promise<InventoryMedia> {
    const media = await this.prisma.inventoryMedia.create({
      data: {
        inventoryId,
        mediaUrl,
        type
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

  async update(id: number, data: { 
    mediaUrl?: string;
    type?: InventoryMediaType;
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



  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.inventoryMedia.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByInventoryId(inventoryId: number): Promise<boolean> {
    try {
      await this.prisma.inventoryMedia.deleteMany({
        where: { inventoryId }
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByInventoryId(inventoryId: number): Promise<number> {
    return await this.prisma.inventoryMedia.count({
      where: { inventoryId }
    });
  }

  async countByType(inventoryId: number, type: InventoryMediaType): Promise<number> {
    return await this.prisma.inventoryMedia.count({
      where: { 
        inventoryId,
        type 
      }
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

  private toDomain(prismaMedia: any): InventoryMedia {
    return new InventoryMedia(
      prismaMedia.id,
      prismaMedia.inventoryId,
      prismaMedia.mediaUrl,
      prismaMedia.type as InventoryMediaType,
      prismaMedia.uploadedAt,
      prismaMedia.createdAt,
      prismaMedia.updatedAt
    );
  }
}