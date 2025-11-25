import { PrismaClient } from '@prisma/client';
import { InventoryPrismaRepository } from '../../infrastructure/repositories/inventory-prisma.repository';
import { ProductExperiencePrismaRepository } from '../../infrastructure/repositories/product-experience-prisma.repository';
import { InventoryMediaPrismaRepository } from '../../infrastructure/repositories/inventory-media-prisma.repository';
import {
  InventoryListItemResponse,
  UpdateInventoryItemDto,
  InventoryItemResponse,
  CreateInventoryRequest,
  InventoryExperienceRequest,
} from '../../interfaces/inventory/inventory.dto';
import logger from '../../infrastructure/logger/logger';
import { ExperienceType } from '../../domain/content/experience-type.enum';
import { ExperienceStatus } from '../../domain/content/experience-status.enum';
import { InventoryMediaType } from '../../domain/inventory/inventory-media-type.enum';

export class InventoryService {
  private readonly prisma: PrismaClient;
  private readonly inventoryRepo: InventoryPrismaRepository;
  private readonly experienceRepo: ProductExperiencePrismaRepository;
  private readonly mediaRepo: InventoryMediaPrismaRepository;

  constructor() {
    this.prisma = new PrismaClient();
    this.inventoryRepo = new InventoryPrismaRepository();
    this.experienceRepo = new ProductExperiencePrismaRepository();
    this.mediaRepo = new InventoryMediaPrismaRepository();
  }

  /**
   * Kullanıcının sahip olduğu ürünlerin listesini getir
   */
  async getUserInventoryList(userId: string): Promise<InventoryListItemResponse[]> {
    try {
      const inventories = await this.inventoryRepo.findCurrentlyOwned(userId);

      const result: InventoryListItemResponse[] = [];

      for (const inventory of inventories) {
        // Product bilgilerini al
        const product = await this.prisma.product.findUnique({
          where: { id: inventory.productId },
          include: {
            group: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
          },
        });

        if (!product) continue;

        // ProductExperience'ları reviews olarak al
        const experiences = await this.experienceRepo.findByInventoryId(inventory.id);

        // Media'dan ilk resmi al
        const images = await this.mediaRepo.findImagesByInventoryId(inventory.id);
        const image = images.length > 0 ? images[0].getMediaUrl() : null;

        // Tags: Content post tags'lerinden al veya product group'dan
        const tags: string[] = [];
        
        // Product ile ilgili content post'larından tags al
        const posts = await this.prisma.contentPost.findMany({
          where: { productId: inventory.productId },
          include: {
            tags: true,
          },
          take: 10,
        });

        const postTags = new Set<string>();
        posts.forEach((post) => {
          post.tags.forEach((tag) => {
            postTags.add(tag.tag);
          });
        });

        // En popüler tag'leri al (max 3)
        const uniqueTags = Array.from(postTags).slice(0, 3);
        tags.push(...uniqueTags);

        // Eğer tag yoksa, inventory'ye göre varsayılan tag'ler ekle
        if (tags.length === 0) {
          const daysSinceCreated = Math.floor(
            (Date.now() - inventory.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceCreated <= 7) {
            tags.push('Recent');
          }
          if (inventory.hasOwned) {
            tags.push('Owned');
          }
        }

        // Reviews oluştur (ProductExperience'ları kullan)
        const reviews = experiences.map((exp) => ({
          title: exp.title,
          description: exp.experienceText,
          rating: 5, // Default rating (ProductExperience'da rating yok)
        }));

        result.push({
          id: inventory.id,
          brand: {
            name: product.brand || 'Unknown',
            model: product.name,
            specs: product.description || '',
          },
          image,
          reviews,
          tags,
        });
      }

      logger.info({
        message: 'User inventory list retrieved',
        userId,
        count: result.length,
      });

      return result;
    } catch (error) {
      logger.error({
        message: 'Error getting user inventory list',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Inventory'ye yeni ürün ekle
   */
  async createInventoryItem(
    userId: string,
    dto: CreateInventoryRequest
  ): Promise<InventoryItemResponse> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const hasOwned = dto.status === ExperienceStatus.OWN;

      const inventory = await this.prisma.$transaction(async (tx) => {
        const createdInventory = await tx.inventory.create({
          data: {
            userId,
            productId: dto.productId,
            hasOwned,
            experienceSummary: dto.content,
          },
        });

        if (dto.experience?.length) {
          await tx.productExperience.createMany({
            data: dto.experience.map((exp) => ({
              inventoryId: createdInventory.id,
              title: this.formatExperienceTitle(exp),
              experienceText: exp.content,
            })),
          });
        }

        if (dto.images?.length) {
          await tx.inventoryMedia.createMany({
            data: dto.images.map((imageUrl) => ({
              inventoryId: createdInventory.id,
              mediaUrl: imageUrl,
              type: InventoryMediaType.IMAGE,
            })),
          });
        }

        return createdInventory;
      });

      logger.info({
        message: 'Inventory item created',
        userId,
        productId: dto.productId,
        inventoryId: inventory.id,
      });

      return {
        id: inventory.id,
        userId: inventory.userId,
        productId: inventory.productId,
        hasOwned: inventory.hasOwned,
        experienceSummary: inventory.experienceSummary,
        createdAt: inventory.createdAt.toISOString(),
        updatedAt: inventory.updatedAt.toISOString(),
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          description: product.description,
        },
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        logger.warn({
          message: 'Inventory already exists for this product and user',
          userId,
          productId: dto.productId,
        });
        throw new Error('Inventory already exists for this product');
      }

      logger.error({
        message: 'Error creating inventory item',
        userId,
        productId: dto.productId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının sahip olduğu ürünlerin listesinde düzenleme yap
   */
  async updateInventoryItem(
    userId: string,
    inventoryId: string,
    dto: UpdateInventoryItemDto
  ): Promise<InventoryItemResponse> {
    try {
      // Inventory'nin kullanıcıya ait olduğunu kontrol et
      const inventory = await this.inventoryRepo.findById(inventoryId);
      if (!inventory) {
        throw new Error('Inventory item not found');
      }

      if (!inventory.belongsToUser(userId)) {
        throw new Error('Unauthorized: Inventory does not belong to user');
      }

      // Update data hazırla
      const updateData: {
        hasOwned?: boolean;
        experienceSummary?: string;
      } = {};

      if (dto.hasOwned !== undefined) {
        updateData.hasOwned = dto.hasOwned;
      }

      if (dto.experienceSummary !== undefined) {
        updateData.experienceSummary = dto.experienceSummary;
      }

      // Eğer productId değişiyorsa, bu özel bir durum (genelde yapılmaz)
      // Şimdilik sadece hasOwned ve experienceSummary güncelliyoruz

      const updatedInventory = await this.inventoryRepo.update(inventoryId, updateData);

      if (!updatedInventory) {
        throw new Error('Failed to update inventory item');
      }

      // Product bilgilerini al
      const product = await this.prisma.product.findUnique({
        where: { id: updatedInventory.productId },
      });

      logger.info({
        message: 'Inventory item updated',
        userId,
        inventoryId,
      });

      return {
        id: updatedInventory.id,
        userId: updatedInventory.userId,
        productId: updatedInventory.productId,
        hasOwned: updatedInventory.hasOwned,
        experienceSummary: updatedInventory.experienceSummary,
        createdAt: updatedInventory.createdAt.toISOString(),
        updatedAt: updatedInventory.updatedAt.toISOString(),
        product: {
          id: product?.id || '',
          name: product?.name || '',
          brand: product?.brand || null,
          description: product?.description || null,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Error updating inventory item',
        userId,
        inventoryId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının sahip olduğu ürünlerin içerisinden ürün kaldır
   */
  async deleteInventoryItem(userId: string, inventoryId: string): Promise<boolean> {
    try {
      // Inventory'nin kullanıcıya ait olduğunu kontrol et
      const inventory = await this.inventoryRepo.findById(inventoryId);
      if (!inventory) {
        throw new Error('Inventory item not found');
      }

      if (!inventory.belongsToUser(userId)) {
        throw new Error('Unauthorized: Inventory does not belong to user');
      }

      const deleted = await this.inventoryRepo.delete(inventoryId);

      if (!deleted) {
        throw new Error('Failed to delete inventory item');
      }

      logger.info({
        message: 'Inventory item deleted',
        userId,
        inventoryId,
      });

      return true;
    } catch (error) {
      logger.error({
        message: 'Error deleting inventory item',
        userId,
        inventoryId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private formatExperienceTitle(experience: InventoryExperienceRequest): string {
    const readable =
      experience.type === ExperienceType.PRICE_AND_SHOPPING
        ? 'Price and Shopping Experience'
        : 'Product and Usage Experience';
    const safeRating = Math.min(Math.max(Math.round(experience.rating), 1), 5);
    return `${readable} (${safeRating}/5)`;
  }
}

