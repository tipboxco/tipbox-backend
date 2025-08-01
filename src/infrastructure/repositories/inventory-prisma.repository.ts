import { PrismaClient } from '@prisma/client';
import { Inventory } from '../../domain/inventory/inventory.entity';

export class InventoryPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<Inventory | null> {
    const inventory = await this.prisma.inventory.findUnique({ 
      where: { id },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      }
    });
    return inventory ? this.toDomain(inventory) : null;
  }

  async findByUserId(userId: number): Promise<Inventory[]> {
    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return inventories.map(inventory => this.toDomain(inventory));
  }

  async findByProductId(productId: number): Promise<Inventory[]> {
    const inventories = await this.prisma.inventory.findMany({
      where: { productId },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return inventories.map(inventory => this.toDomain(inventory));
  }

  async findByUserAndProduct(userId: number, productId: number): Promise<Inventory[]> {
    const inventories = await this.prisma.inventory.findMany({
      where: { 
        userId,
        productId 
      },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return inventories.map(inventory => this.toDomain(inventory));
  }

  async create(
    userId: number, 
    productId: number, 
    hasOwned: boolean = true,
    experienceSummary?: string
  ): Promise<Inventory> {
    const inventory = await this.prisma.inventory.create({
      data: {
        userId,
        productId,
        hasOwned,
        experienceSummary
      },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      }
    });
    return this.toDomain(inventory);
  }

  async update(id: number, data: { 
    hasOwned?: boolean;
    experienceSummary?: string;
  }): Promise<Inventory | null> {
    const inventory = await this.prisma.inventory.update({
      where: { id },
      data,
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      }
    });
    return inventory ? this.toDomain(inventory) : null;
  }

  async updateOwnershipStatus(id: number, hasOwned: boolean): Promise<Inventory | null> {
    const inventory = await this.prisma.inventory.update({
      where: { id },
      data: { hasOwned },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      }
    });
    return inventory ? this.toDomain(inventory) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.inventory.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async findCurrentlyOwned(userId: number): Promise<Inventory[]> {
    const inventories = await this.prisma.inventory.findMany({
      where: { 
        userId,
        hasOwned: true 
      },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return inventories.map(inventory => this.toDomain(inventory));
  }

  async findRecentPurchases(userId: number, days: number = 30): Promise<Inventory[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const inventories = await this.prisma.inventory.findMany({
      where: { 
        userId,
        createdAt: {
          gte: since
        }
      },
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return inventories.map(inventory => this.toDomain(inventory));
  }

  async list(): Promise<Inventory[]> {
    const inventories = await this.prisma.inventory.findMany({
      include: {
        user: true,
        product: true,
        productExperiences: true,
        media: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return inventories.map(inventory => this.toDomain(inventory));
  }

  private toDomain(prismaInventory: any): Inventory {
    return new Inventory(
      prismaInventory.id,
      prismaInventory.userId,
      prismaInventory.productId,
      prismaInventory.hasOwned,
      prismaInventory.experienceSummary,
      prismaInventory.createdAt,
      prismaInventory.updatedAt
    );
  }
}