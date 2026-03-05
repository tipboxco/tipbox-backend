import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { InventoryPrismaRepository } from '../../infrastructure/repositories/inventory-prisma.repository';
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
import { AIPipelineLogger } from '../../infrastructure/ai/ai-pipeline-logger';
import { AiExperienceSplitPrismaRepository } from '../../infrastructure/repositories/ai-experience-split-prisma.repository';
import { AchievementProgressService } from '../gamification/achievement-progress.service';
import { ActionLogService } from '../gamification/action-log.service';
import { MainAction } from '../../domain/gamification/main-action.enum';
import { PostService } from '../post/post.service';
import { ContextType } from '../../domain/content/context-type.enum';

export class InventoryService {
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly inventoryRepo: InventoryPrismaRepository;
  private readonly mediaRepo: InventoryMediaPrismaRepository;
  private readonly cacheService: CacheService;
  private readonly geminiService: GeminiService;
  private readonly experienceSnippetRepo: AiExperienceSplitPrismaRepository;
  private readonly achievementProgressService: AchievementProgressService;
  private readonly actionLogService: ActionLogService;
  private _postService?: PostService;

  constructor() {
    this.prisma = getPrisma();
    this.inventoryRepo = new InventoryPrismaRepository();
    this.mediaRepo = new InventoryMediaPrismaRepository();
    this.cacheService = CacheService.getInstance();
    this.geminiService = GeminiService.getInstance();
    this.experienceSnippetRepo = new AiExperienceSplitPrismaRepository();
    this.achievementProgressService = new AchievementProgressService();
    this.actionLogService = new ActionLogService();
    // PostService lazy initialization to break circular dependency
  }

  // Lazy initialization for PostService to break circular dependency
  private get postService(): PostService {
    if (!this._postService) {
      this._postService = new PostService();
    }
    return this._postService;
  }

  /**
   * Search product experiences by title and text
   */
  async searchExperiences(query: string, options?: { limit?: number; cursor?: string }): Promise<{
    items: Array<Record<string, unknown>>;
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit || 20;
    const searchTrimmed = query?.trim();

    if (!searchTrimmed) {
      return { items: [], pagination: { hasMore: false, limit } };
    }

    // ProductExperience tablosu artık yok, boş sonuç dön
    // Return empty result immediately since the table no longer exists
    return {
      items: [],
      pagination: {
        hasMore: false,
        limit,
      },
    };
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
            brand: true,
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

        // ProductExperience tablosu artık yok, boş array kullan
        const experiences: Array<{ title: string; experienceText: string }> = [];

        // Media'dan ilk resmi al
        const images = await this.mediaRepo.findByInventoryId(inventory.id);
        let image: string | null = null;
        if (images.length > 0) {
          const mediaUrl = images[0].getMediaUrl();
          // Eğer zaten tam URL ise olduğu gibi kullan, değilse prefix ekle
          if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
            image = mediaUrl;
          } else {
            const { resolveMediaUrl } = await import('../../infrastructure/config/media.config');
            image = resolveMediaUrl(mediaUrl);
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
          productId: inventory.productId, // ✅ YENİ: Product ID eklendi
          brand: {
            name: product.brand?.name || 'Unknown',
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
   * Kullanıcının deneyim metnini AI ile ayır ve database'e kaydet
   */
  async splitExperienceWithAI(
    userId: string,
    productId: string,
    experienceText: string,
  ): Promise<{
    experienceSnippetId: string;
    priceAndShopping: {
      content: string;
      rating: number;
      placeholder?: string | null;
      isEnhanced?: boolean;
    } | null;
    productAndUsage: {
      content: string;
      rating: number;
      placeholder?: string | null;
      isEnhanced?: boolean;
    } | null;
    metadata: {
      tokensUsed: number | null;
      processingTimeMs: number;
      model: string;
      promptVersion: string;
    };
  }> {
    const pipeline = new AIPipelineLogger({
      pipelineName: 'InventoryService',
      operationName: 'splitExperienceWithAI',
      totalStages: 3,
      metadata: { userId, productId },
    });

    try {
      // [1/3] Ürün bilgilerini al
      const product = await pipeline.runStage('Loading product', async () => {
        const p = await this.prisma.product.findUnique({
          where: { id: productId },
          include: { brand: true },
        });
        if (!p) throw new Error('Product not found');
        return p;
      });

      // [2/3] Gemini AI ile deneyimi ayır
      const splitResult = await pipeline.runStage('Splitting experience with AI', () =>
        this.geminiService.splitExperience({
          productId,
          productName: product.name,
          productBrand: product.brand?.name || undefined,
          productDescription: product.description || undefined,
          experienceText,
        }),
      );

      // [3/3] AI split sonucunu database'e kaydet
      const experienceSnippet = await pipeline.runStage('Saving to database', () =>
        this.experienceSnippetRepo.create({
          userId,
          productId,
          originalExperience: experienceText,
          priceAndShopping: splitResult.priceAndShopping?.content ?? null,
          productAndUsage: splitResult.productAndUsage?.content ?? null,
          priceAndShoppingRating: splitResult.priceAndShopping?.rating ?? null,
          productAndUsageRating: splitResult.productAndUsage?.rating ?? null,
          priceAndShoppingPlaceholder: splitResult.priceAndShopping?.placeholder ?? null,
          productAndUsagePlaceholder: splitResult.productAndUsage?.placeholder ?? null,
          priceAndShoppingIsEnhanced: splitResult.priceAndShopping?.isEnhanced ?? null,
          productAndUsageIsEnhanced: splitResult.productAndUsage?.isEnhanced ?? null,
          isEdited: false,
          model: splitResult.metadata.model,
          promptVersion: splitResult.metadata.promptVersion,
          tokensUsed: splitResult.metadata.tokensUsed,
          processingTimeMs: splitResult.metadata.processingTimeMs,
        }),
      );

      pipeline.complete({
        experienceSnippetId: experienceSnippet.id,
        tokens: splitResult.metadata.tokensUsed,
      });

      return {
        experienceSnippetId: experienceSnippet.id,
        priceAndShopping: splitResult.priceAndShopping,
        productAndUsage: splitResult.productAndUsage,
        metadata: splitResult.metadata,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      pipeline.fail(errorMsg);
      throw error;
    }
  }

  /**
   * Ürün hakkında Gemini ile Experience metni üretir (ContentPost için).
   * Owned ürün eklerken content yoksa veya kısa ise kullanılır.
   */
  private async generateExperienceText(product: {
    name: string;
    description: string | null;
    brand?: { name: string } | null;
  }): Promise<string> {
    const result = await this.geminiService.generatePostContent({
      postType: 'EXPERIENCE',
      persona: 'product reviewer',
      productName: product.name,
      productBrand: product.brand?.name ?? undefined,
      productDescription: product.description ?? undefined,
    });
    return result.body?.trim() ?? '';
  }

  /**
   * Inventory'ye yeni ürün ekle
   * Owned + Experience akışı: 1) Experience metni (kullanıcı veya Gemini), 2) Split (Gemini), 3) AIExperienceSplit kaydı, 4) Inventory, 5) ContentPost (Experience post).
   */
  async createInventoryItem(
    userId: string,
    dto: CreateInventoryRequest,
  ): Promise<InventoryItemResponse> {
    const hasOwned = dto.status === ExperienceStatus.OWN;
    const pipeline = new AIPipelineLogger({
      pipelineName: 'InventoryService',
      operationName: 'createInventoryItem',
      totalStages: 5,
      metadata: { userId, productId: dto.productId, owned: hasOwned },
    });

    try {
      // [1/5] Load product
      const product = await pipeline.runStage('Loading product', async () => {
        const p = await this.prisma.product.findUnique({
          where: { id: dto.productId },
          include: { brand: true },
        });
        if (!p) throw new Error('Product not found');
        return p;
      });

      let experienceText = dto.content?.trim() ?? '';
      let experienceSnippetId: string | null = dto.experienceSnippetId ?? null;
      let splitResult: Awaited<ReturnType<InventoryService['splitExperienceWithAI']>> | null = null;

      // [2/5] Generate experience text (opsiyonel)
      if (hasOwned && (!experienceText || experienceText.length < 20)) {
        const generated = await pipeline.runStageOptional(
          'Generating experience text',
          () => this.generateExperienceText(product),
          '',
        );
        if (generated) experienceText = generated;
        if (!experienceText) {
          experienceText = `${product.name}${product.brand?.name ? ` (${product.brand.name})` : ''} ürünüyle ilgili deneyim paylaşımı.`;
        }
      } else {
        pipeline.skipStage('Generating experience text');
      }

      // [3/5] Split experience with AI (opsiyonel)
      if (hasOwned && !experienceSnippetId) {
        splitResult = await pipeline.runStageOptional(
          'Splitting experience with AI',
          async () => {
            const result = await this.splitExperienceWithAI(userId, dto.productId, experienceText);
            experienceSnippetId = result.experienceSnippetId;
            return result;
          },
          null,
        );
      } else {
        pipeline.skipStage('Splitting experience with AI');
      }

      // [4/5] Create inventory record
      const experienceSummary =
        experienceText.length > 200 ? experienceText.substring(0, 200) : experienceText;

      const inventory = await pipeline.runStage('Creating inventory record', () =>
        this.prisma.$transaction(async (tx) => {
          const createdInventory = await tx.inventory.create({
            data: {
              userId,
              productId: dto.productId,
              hasOwned,
              experienceSummary,
              experienceSnippetId,
              experienceDurationId: dto.selectedDurationId || null,
              experienceLocationId: dto.selectedLocationId || null,
              experiencePurposeId: dto.selectedPurposeId || null,
            },
          });

          if (dto.images?.length) {
            await tx.inventoryMedia.createMany({
              data: dto.images.map((imageUrl) => ({
                inventoryId: createdInventory.id,
                mediaUrl: imageUrl,
              })),
            });
          }

          return createdInventory;
        }),
      );

      // [5/5] Create experience post (opsiyonel)
      if (hasOwned && experienceText) {
        let experienceArray: { type: ExperienceType; content: string; rating: number }[] = [];
        if (splitResult) {
          if (splitResult.priceAndShopping?.content) {
            experienceArray.push({
              type: ExperienceType.PRICE_AND_SHOPPING,
              content: splitResult.priceAndShopping.content,
              rating: splitResult.priceAndShopping.rating ?? 4,
            });
          }
          if (splitResult.productAndUsage?.content) {
            experienceArray.push({
              type: ExperienceType.PRODUCT_AND_USAGE,
              content: splitResult.productAndUsage.content,
              rating: splitResult.productAndUsage.rating ?? 4,
            });
          }
        }
        if (
          experienceArray.length === 0 &&
          Array.isArray(dto.experience) &&
          dto.experience.length > 0
        ) {
          experienceArray = dto.experience.map((e) => ({
            type: e.type as ExperienceType,
            content: e.content,
            rating: typeof e.rating === 'number' ? e.rating : 4,
          }));
        }
        if (experienceArray.length > 0 && experienceSnippetId) {
          await pipeline.runStageOptional(
            'Creating experience post',
            () =>
              this.postService.createExperiencePost(userId, {
                contextType: ContextType.PRODUCT,
                contextId: dto.productId,
                selectedDurationId: dto.selectedDurationId || null,
                selectedLocationId: dto.selectedLocationId || null,
                selectedPurposeId: dto.selectedPurposeId || null,
                content: experienceText,
                experience: experienceArray,
                status: ExperienceStatus.OWN,
                images: dto.images,
                experienceSnippetId,
              }),
            undefined,
          );
        } else {
          pipeline.skipStage('Creating experience post');
        }
      } else {
        pipeline.skipStage('Creating experience post');
      }

      pipeline.complete({ inventoryId: inventory.id });

      // Action log (fire-and-forget)
      this.actionLogService
        .logAction({
          userId,
          mainAction: MainAction.SYSTEM,
          actionTypeCode: 'INVENTORY_ADD',
          entityType: 'inventory',
          entityId: inventory.id,
          metadata: { productId: dto.productId },
        })
        .catch((err) => {
          logger.warn({
            message: 'Failed to log INVENTORY_ADD action',
            userId,
            inventoryId: inventory.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      // Collection badge progress (SYSTEM + INVENTORY_ADD) - async
      this.achievementProgressService
        .incrementProgressByCode(userId, MainAction.SYSTEM, 'INVENTORY_ADD', 1)
        .catch((err) => {
          logger.warn({
            message: 'Failed to increment achievement progress for inventory create',
            userId,
            inventoryId: inventory.id,
            error: err instanceof Error ? err.message : String(err),
          });
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
          brand: product.brand?.name || null,
          description: product.description,
        },
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        logger.warn({
          message: 'Inventory already exists for this product and user',
          userId,
          productId: dto.productId,
        });
        throw new Error('Inventory already exists for this product');
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      pipeline.fail(errorMsg);
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
        include: {
          brand: true,
        },
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
          brand: product?.brand?.name || null,
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

  /**
   * Kullanıcının envanterinde belirli bir ürün var mı kontrol et
   */
  async hasProductInInventory(userId: string, productId: string): Promise<boolean> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          userId,
          productId,
        },
        select: { id: true },
      });

      return !!inventory;
    } catch (error) {
      logger.error({
        message: 'Error checking product in inventory',
        userId,
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Inventory cache'ini temizle
   */
  async clearInventoryCache(userId: string, clearAll: boolean = false): Promise<{ message: string; cleared: number }> {
    try {
      let cleared = 0;

      if (clearAll) {
        // Tüm inventory cache'lerini temizle
        const pattern = 'inventory:user:*:list';
        const keys: string[] = [];
        
        // Redis scan ile tüm matching keys'leri bul
        let cursor = '0';
        do {
          const result = await this.cacheService.scan(cursor, pattern);
          cursor = result.cursor;
          keys.push(...result.keys);
        } while (cursor !== '0');

        // Tüm keys'leri sil
        for (const key of keys) {
          await this.cacheService.delete(key);
          cleared++;
        }

        logger.info({
          message: 'All inventory cache cleared',
          pattern,
          cleared,
        });

        return {
          message: `All inventory cache cleared (${cleared} entries)`,
          cleared,
        };
      } else {
        // Belirli bir kullanıcının cache'ini temizle
        const cacheKey = `inventory:user:${userId}:list`;
        const deleted = await this.cacheService.delete(cacheKey);
        
        if (deleted) {
          cleared = 1;
          logger.info({
            message: 'User inventory cache cleared',
            userId,
            cacheKey,
          });
        }

        return {
          message: deleted 
            ? `Inventory cache cleared for user ${userId}` 
            : `No cache found for user ${userId}`,
          cleared,
        };
      }
    } catch (error) {
      logger.error('Failed to clear inventory cache:', error);
      throw error;
    }
  }
}
