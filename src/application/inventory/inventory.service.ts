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
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import { GeminiService } from '../../infrastructure/ai/gemini.service';

export class InventoryService {
  private readonly prisma: PrismaClient;
  private readonly inventoryRepo: InventoryPrismaRepository;
  private readonly experienceRepo: ProductExperiencePrismaRepository;
  private readonly mediaRepo: InventoryMediaPrismaRepository;
  private readonly cacheService: CacheService;
  private readonly geminiService: GeminiService;

  constructor() {
    this.prisma = new PrismaClient();
    this.inventoryRepo = new InventoryPrismaRepository();
    this.experienceRepo = new ProductExperiencePrismaRepository();
    this.mediaRepo = new InventoryMediaPrismaRepository();
    this.cacheService = CacheService.getInstance();
    this.geminiService = GeminiService.getInstance();
  }

  /**
   * Kullanıcının sahip olduğu ürünlerin listesini getir
   */
  async getUserInventoryList(userId: string): Promise<InventoryListItemResponse[]> {
    const cacheKey = `inventory:user:${userId}:list`;

    // Cache check (otomatik hit/miss işaretler)
    try {
      const cached = await this.cacheService.get<InventoryListItemResponse[]>(cacheKey);
      if (cached) {
        logger.info({ message: 'Inventory list served from cache', userId, cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

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
        const images = await this.mediaRepo.findByInventoryId(inventory.id);
        let image: string | null = null;
        if (images.length > 0) {
          const mediaUrl = images[0].getMediaUrl();
          // Eğer zaten tam URL ise olduğu gibi kullan, değilse prefix ekle
          if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
            image = mediaUrl;
          } else {
            const { getPublicMediaBaseUrl } = await import('../../infrastructure/config/media.config');
            const baseUrl = getPublicMediaBaseUrl();
            image = `${baseUrl}/${mediaUrl}`;
          }
        }

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

      // Cache'e kaydet
      try {
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM); // 30 dakika
      } catch (error) {
        logger.warn({ message: 'Cache set failed', error: error instanceof Error ? error.message : String(error) });
      }

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
   * Kullanıcının deneyim metnini AI ile ayır
   */
  async splitExperienceWithAI(
    userId: string,
    productId: string,
    experienceText: string
  ): Promise<{
    priceAndShopping: { content: string; rating: number } | null;
    productAndUsage: { content: string; rating: number } | null;
  }> {
    try {
      // Ürün bilgilerini al
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Gemini AI ile deneyimi ayır
      const splitResult = await this.geminiService.splitExperience({
        productName: product.name,
        productBrand: product.brand || undefined,
        productDescription: product.description || undefined,
        experienceText,
      });

      logger.info({
        message: 'Experience split with AI',
        userId,
        productId,
        hasPriceAndShopping: !!splitResult.priceAndShopping,
        hasProductAndUsage: !!splitResult.productAndUsage,
      });

      return splitResult;
    } catch (error) {
      logger.error({
        message: 'Error splitting experience with AI',
        userId,
        productId,
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

