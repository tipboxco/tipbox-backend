import { ContentPostPrismaRepository } from '../../infrastructure/repositories/content-post-prisma.repository';
import { PostTipPrismaRepository } from '../../infrastructure/repositories/post-tip-prisma.repository';
import { PostQuestionPrismaRepository } from '../../infrastructure/repositories/post-question-prisma.repository';
import { PostComparisonPrismaRepository } from '../../infrastructure/repositories/post-comparison-prisma.repository';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { ContextType } from '../../domain/content/context-type.enum';
import { withCache } from '../../infrastructure/cache/cache-wrapper.helper';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import { TipsAndTricksBenefitCategory } from '../../domain/content/tips-and-tricks-benefit-category.enum';
import { TipCategory } from '../../domain/content/tip-category.enum';
import { QuestionAnswerFormat } from '../../domain/content/question-answer-format.enum';
import { ExperienceType } from '../../domain/content/experience-type.enum';
import { ExperienceStatus } from '../../domain/content/experience-status.enum';
import {
  CreatePostRequest,
  CreateTipsAndTricksPostRequest,
  CreateQuestionPostRequest,
  CreateBenchmarkPostRequest,
  CreateExperiencePostRequest,
  CreateUpdatePostRequest,
  UpdatePostRequest,
  BoostOption,
  SplitExperienceRequest,
  SplitExperienceResponse,
  Experience,
} from '../../interfaces/post/post.dto';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { FeedService } from '../feed/feed.service';
import logger from '../../infrastructure/logger/logger';
import { GeminiService } from '../../infrastructure/ai/gemini.service';
import { AiExperienceSplitPrismaRepository } from '../../infrastructure/repositories/ai-experience-split-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { EventService } from '../event/event.service';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { invalidateCatalogPostsCache } from '../../infrastructure/cache/cache-invalidation';
import { EventMetricsService } from '../event/event-metrics.service';
import { BadgeEligibilityService } from '../gamification/badge-eligibility.service';
import { AchievementProgressService } from '../gamification/achievement-progress.service';
import { AchievementGoalType } from '../../domain/gamification/achievement-goal-type.enum';

export class PostService {
  private postRepo: ContentPostPrismaRepository;
  private tipRepo: PostTipPrismaRepository;
  private questionRepo: PostQuestionPrismaRepository;
  private comparisonRepo: PostComparisonPrismaRepository;
  private feedService: FeedService;
  private prisma: ReturnType<typeof getPrisma>;
  private geminiService: GeminiService;
  private eventService: EventService;
  private experienceSnippetRepo: AiExperienceSplitPrismaRepository;
  private s3Service: S3Service;
  private eventMetricsService: EventMetricsService;
  private badgeEligibilityService: BadgeEligibilityService;
  private achievementProgressService: AchievementProgressService;

  /**
   * Search posts by title and body
   */
  async searchPosts(query: string, options?: { limit?: number; cursor?: string }): Promise<{
    items: any[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit || 20;
    const searchTrimmed = query?.trim();
    
    if (!searchTrimmed) {
      return { items: [], pagination: { hasMore: false, limit } };
    }

    const posts = await this.postRepo.search(searchTrimmed);
    
    // Apply cursor-based pagination if needed
    let resultPosts = posts;
    if (options?.cursor) {
      const cursorIndex = resultPosts.findIndex(p => p.id === options.cursor);
      if (cursorIndex >= 0) {
        resultPosts = resultPosts.slice(cursorIndex + 1);
      }
    }
    
    const hasMore = resultPosts.length > limit;
    const paginated = hasMore ? resultPosts.slice(0, limit) : resultPosts;
    const nextCursor = hasMore && paginated.length > 0 ? paginated[paginated.length - 1].id : undefined;

    // Return posts directly (feed conversion removed - mapContentPostToFeedItem method doesn't exist)
    return {
      items: paginated,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  constructor() {
    this.postRepo = new ContentPostPrismaRepository();
    this.tipRepo = new PostTipPrismaRepository();
    this.questionRepo = new PostQuestionPrismaRepository();
    this.comparisonRepo = new PostComparisonPrismaRepository();
    this.feedService = new FeedService();
    this.prisma = getPrisma();
    this.geminiService = GeminiService.getInstance();
    this.experienceSnippetRepo = new AiExperienceSplitPrismaRepository();
    this.eventService = new EventService();
    this.s3Service = new S3Service();
    this.eventMetricsService = new EventMetricsService();
    this.badgeEligibilityService = new BadgeEligibilityService();
    this.achievementProgressService = new AchievementProgressService();
  }

  /**
   * Event validation - event mevcut ve aktif mi kontrol eder
   */
  private async validateEvent(eventId: string): Promise<void> {
    // Validate eventId format (should be a valid string, not "string", "null", etc.)
    if (!eventId) {
      throw new Error('Event ID is required');
    }
    
    if (typeof eventId !== 'string') {
      throw new Error(`Invalid eventId type: expected string, got ${typeof eventId}`);
    }
    
    const trimmed = eventId.trim();
    
    if (trimmed === '' ||
        trimmed.toLowerCase() === 'string' ||
        trimmed.toLowerCase() === 'null' ||
        trimmed.toLowerCase() === 'undefined' ||
        trimmed.toLowerCase() === 'none' ||
        trimmed === '0' ||
        trimmed === 'false') {
      throw new Error(`Invalid eventId value: "${eventId}"`);
    }

    const event = await this.prisma.wishboxEvent.findUnique({
      where: { id: trimmed },
    });

    if (!event) {
      throw new Error(`Event not found: ${trimmed}`);
    }

    // Event'in aktif olup olmadığını kontrol et
    const now = new Date();
    if (event.startDate > now || event.endDate < now) {
      throw new Error('Event is not active');
    }

    // Event status'u PUBLISHED olmalı
    if (event.status !== 'PUBLISHED') {
      throw new Error('Event is not published');
    }
  }

  /**
   * Context type'dan category ID'lerini resolve eder
   */
  /**
   * Product ID'yi resolve eder - hem id hem externalId (metadata içinde) ile arama yapar
   * Public metod - router'dan da kullanılabilir
   * Tüm ID formatlarını kabul eder (UUID, ULID, Medusa ID, vb.)
   */
  async resolveProductId(productIdOrExternalId: string): Promise<string> {
    // Önce direkt id ile ara (herhangi bir format olabilir)
    let product = await this.prisma.product.findUnique({
      where: { id: productIdOrExternalId },
      select: { id: true },
    });

    if (product) {
      return product.id;
    }

    // Eğer bulunamazsa, metadata içindeki externalId ile ara
    // PostgreSQL JSONB için raw SQL query kullan (Prisma JSON query syntax'ı sınırlı)
    try {
      const result = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id 
        FROM products 
        WHERE metadata->>'externalId' = ${productIdOrExternalId}
        LIMIT 1
      `;

      if (result && result.length > 0) {
        return result[0].id;
      }
    } catch (error) {
      // Raw query hatası - log'la ve devam et
      logger.warn({
        message: 'Failed to query product by externalId',
        productIdOrExternalId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Hala bulunamazsa, hata fırlat
    throw new Error(`Product not found with id or externalId: ${productIdOrExternalId}`);
  }

  /**
   * SubCategory ID'yi resolve eder - hem id hem externalId ile arama yapar
   * Tüm ID formatlarını kabul eder (UUID, ULID, Medusa ID, vb.)
   */
  async resolveSubCategoryId(subCategoryIdOrExternalId: string): Promise<string> {
    const trimmedId = subCategoryIdOrExternalId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(trimmedId);

    // UUID formatındaysa, direkt id ile ara (try-catch ile)
    if (isUuid) {
      try {
        const subCategory = await this.prisma.subCategory.findUnique({
          where: { id: trimmedId },
          select: { id: true },
        });

        if (subCategory) {
          return subCategory.id;
        }
      } catch (error) {
        // UUID formatı geçersiz olabilir - devam et
        logger.debug({
          message: 'SubCategory UUID query failed',
          subCategoryIdOrExternalId: trimmedId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // UUID değilse veya bulunamazsa, Category tablosunda externalId ile ara
    // SubCategory tablosunda metadata field'ı yok, bu yüzden Category tablosunda arama yapıyoruz
    try {
      const categoryResult = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name 
        FROM categories 
        WHERE metadata->>'externalId' = ${trimmedId}
           OR metadata->>'medusaId' = ${trimmedId}
        LIMIT 1
      `;

      if (categoryResult && categoryResult.length > 0) {
        const category = categoryResult[0];
        
        // Category name ile SubCategory'yi bul
        const subCategory = await this.prisma.subCategory.findFirst({
          where: { name: category.name },
          select: { id: true },
        });

        if (subCategory) {
          return subCategory.id;
        }
      }
    } catch (error) {
      logger.debug({
        message: 'SubCategory Category lookup failed',
        subCategoryIdOrExternalId: trimmedId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Hala bulunamazsa, hata fırlat
    throw new Error(`SubCategory not found with id or externalId: ${subCategoryIdOrExternalId}`);
  }

  /**
   * ProductGroup ID'yi resolve eder - hem id hem externalId ile arama yapar
   * Tüm ID formatlarını kabul eder (UUID, ULID, Medusa ID, vb.)
   */
  async resolveProductGroupId(productGroupIdOrExternalId: string): Promise<string> {
    const trimmedId = productGroupIdOrExternalId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(trimmedId);

    // UUID formatındaysa, direkt id ile ara (try-catch ile)
    if (isUuid) {
      try {
        const productGroup = await this.prisma.productGroup.findUnique({
          where: { id: trimmedId },
          select: { id: true },
        });

        if (productGroup) {
          return productGroup.id;
        }
      } catch (error) {
        // UUID formatı geçersiz olabilir - devam et
        logger.debug({
          message: 'ProductGroup UUID query failed',
          productGroupIdOrExternalId: trimmedId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // UUID değilse veya bulunamazsa, Category tablosunda externalId ile ara
    // ProductGroup tablosunda metadata field'ı yok, bu yüzden Category tablosunda arama yapıyoruz
    try {
      const categoryResult = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name 
        FROM categories 
        WHERE metadata->>'externalId' = ${trimmedId}
           OR metadata->>'medusaId' = ${trimmedId}
        LIMIT 1
      `;

      if (categoryResult && categoryResult.length > 0) {
        const category = categoryResult[0];
        
        // Category name ile ProductGroup'u bul
        const productGroup = await this.prisma.productGroup.findFirst({
          where: { name: category.name },
          select: { id: true },
        });

        if (productGroup) {
          return productGroup.id;
        }
      }
    } catch (error) {
      logger.debug({
        message: 'ProductGroup Category lookup failed',
        productGroupIdOrExternalId: trimmedId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Hala bulunamazsa, hata fırlat
    throw new Error(`ProductGroup not found with id or externalId: ${productGroupIdOrExternalId}`);
  }

  /**
   * MainCategory ID'yi resolve eder - hem id hem externalId ile arama yapar
   * Tüm ID formatlarını kabul eder (UUID, ULID, Medusa ID, vb.)
   */
  async resolveMainCategoryId(mainCategoryIdOrExternalId: string): Promise<string> {
    const trimmedId = mainCategoryIdOrExternalId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(trimmedId);

    // UUID formatındaysa, direkt id ile ara (try-catch ile)
    if (isUuid) {
      try {
        const mainCategory = await this.prisma.mainCategory.findUnique({
          where: { id: trimmedId },
          select: { id: true },
        });

        if (mainCategory) {
          return mainCategory.id;
        }
      } catch (error) {
        // UUID formatı geçersiz olabilir - devam et
        logger.debug({
          message: 'MainCategory UUID query failed',
          mainCategoryIdOrExternalId: trimmedId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // UUID değilse veya bulunamazsa, Category tablosunda externalId ile ara
    // MainCategory tablosunda metadata field'ı yok, bu yüzden Category tablosunda arama yapıyoruz
    try {
      const categoryResult = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name 
        FROM categories 
        WHERE metadata->>'externalId' = ${trimmedId}
           OR metadata->>'medusaId' = ${trimmedId}
        LIMIT 1
      `;

      if (categoryResult && categoryResult.length > 0) {
        const category = categoryResult[0];
        
        // Category name ile MainCategory'yi bul
        const mainCategory = await this.prisma.mainCategory.findFirst({
          where: { name: category.name },
          select: { id: true },
        });

        if (mainCategory) {
          return mainCategory.id;
        }
      }
    } catch (error) {
      logger.debug({
        message: 'MainCategory Category lookup failed',
        mainCategoryIdOrExternalId: trimmedId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Hala bulunamazsa, hata fırlat
    throw new Error(`MainCategory not found with id or externalId: ${mainCategoryIdOrExternalId}`);
  }

  private async resolveContextIds(
    contextType: ContextType,
    contextId: string
  ): Promise<{
    subCategoryId?: string;
    productGroupId?: string;
    productId?: string;
    mainCategoryId?: string;
  }> {
    switch (contextType) {
      case ContextType.SUB_CATEGORY:
        // ExternalId desteği ile subCategory'ı resolve et
        const resolvedSubCategoryId = await this.resolveSubCategoryId(contextId);
        const subCategory = await this.prisma.subCategory.findUnique({
          where: { id: resolvedSubCategoryId },
          include: { mainCategory: true },
        });
        if (!subCategory) {
          logger.warn({
            message: 'Sub-category not found in post creation',
            contextId,
            resolvedSubCategoryId,
          });
          throw new Error(`Sub-category does not exist or has been deleted. Please select a valid category.`);
        }
        return {
          subCategoryId: resolvedSubCategoryId, // Resolved subCategory ID kullan
          mainCategoryId: subCategory.mainCategoryId || undefined,
        };

      case ContextType.PRODUCT_GROUP:
        // ExternalId desteği ile productGroup'ı resolve et
        const resolvedProductGroupId = await this.resolveProductGroupId(contextId);
        const productGroup = await this.prisma.productGroup.findUnique({
          where: { id: resolvedProductGroupId },
          include: { subCategory: { include: { mainCategory: true } } },
        });
        if (!productGroup) {
          throw new Error(`Product group not found: ${contextId}`);
        }
        return {
          productGroupId: resolvedProductGroupId, // Resolved productGroup ID kullan
          subCategoryId: productGroup.subCategoryId || undefined,
          mainCategoryId: productGroup.subCategory?.mainCategoryId || undefined,
        };

      case ContextType.PRODUCT:
        // ExternalId desteği ile product'ı resolve et
        const resolvedProductId = await this.resolveProductId(contextId);
        const product = await this.prisma.product.findUnique({
          where: { id: resolvedProductId },
          include: {
            group: {
              include: {
                subCategory: { include: { mainCategory: true } },
              },
            },
          },
        });
        if (!product) {
          // Daha açıklayıcı hata mesajı
          logger.warn({
            message: 'Product not found in post creation',
            contextId,
            resolvedProductId,
            userId: 'unknown', // userId buraya gelemez, stack'te ekleyelim
          });
          throw new Error(`Product does not exist or has been deleted. Please select a valid product.`);
        }
        return {
          productId: resolvedProductId, // Resolved product ID kullan
          productGroupId: product.groupId || undefined,
          subCategoryId: product.group?.subCategoryId || undefined,
          mainCategoryId: product.group?.subCategory?.mainCategoryId || undefined,
        };

      default:
        throw new Error(`Invalid context type: ${contextType}`);
    }
  }

  /**
   * Image URL'lerini post body'sine ekler
   */
  private appendImagesToBody(body: string, images?: string[]): string {
    // NOTE:
    // Artık görselleri sadece ayrı `images` alanında tutuyoruz.
    // Content (body) kullanıcı açıklamasını temsil edecek ve
    // feed card'larında sade, okunabilir metin olarak kullanılacak.
    // Bu nedenle image URL'lerini markdown olarak body'ye eklemiyoruz.
    return body;
  }

  /**
   * Serbest gönderi oluştur
   */
  async createFreePost(
    userId: string,
    request: CreatePostRequest
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // ✅ YENİ: InventoryId varsa, productId'yi inventory'den çek
      let actualContextId = request.contextId;
      
      if (request.inventoryId && request.contextType === ContextType.PRODUCT) {
        // InventoryId'den productId'yi resolve et
        const productId = await this.resolveProductIdFromInventory(
          request.inventoryId,
          userId
        );
        actualContextId = productId;
        
        logger.info({
          message: 'Using productId from inventory',
          inventoryId: request.inventoryId,
          productId,
          originalContextId: request.contextId,
        });
      }

      // Context validation
      if (
        request.contextType !== ContextType.SUB_CATEGORY &&
        request.contextType !== ContextType.PRODUCT_GROUP &&
        request.contextType !== ContextType.PRODUCT
      ) {
        throw new Error(
          'Free posts can only be created for sub_category, product_group, or product'
        );
      }

      // Event validation and membership check (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
        await this.validateEventMembership(userId, request.eventId);

        // ✅ ROASTS event'lerde productStatus beklenir (app own|tried gönderir)
        const event = await this.prisma.wishboxEvent.findUnique({
          where: { id: request.eventId },
          select: { feedType: true },
        });
        if ((event as any)?.feedType === 'ROASTS') {
          if (!request.productStatus) {
            throw new Error('productStatus is required for ROASTS event posts');
          }
          if (request.productStatus !== 'own' && request.productStatus !== 'tried') {
            throw new Error("productStatus must be 'own' or 'tried'");
          }
        }
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        actualContextId // ✅ InventoryId'den gelen productId veya direkt contextId
      );

      // Support both 'body' (new) and 'description' (old) fields
      const postContent = request.body || request.description || '';
      
      const bodyWithImages = this.appendImagesToBody(
        postContent,
        request.images
      );

      const post = await this.postRepo.create(
        userId,
        ContentPostType.FREE,
        request.title || '',
        bodyWithImages,
        contextIds.subCategoryId,
        contextIds.mainCategoryId,
        contextIds.productGroupId,
        contextIds.productId,
        false,
        false,
        request.eventId,
        request.productStatus
      );

      // Görselleri PostMedia'ya kaydet (orderIndex ile sıralı)
      if (request.images && request.images.length > 0) {
        await this.prisma.postMedia.createMany({
          data: request.images.map((imageUrl, index) => ({
            postId: post.id,
            userId: userId,
            mediaUrl: imageUrl,
            orderIndex: index,
          })),
        });
      }

      // Update user event stats if eventId is provided
      if (request.eventId) {
        try {
          // Increment post count for user's event stats
          await this.prisma.wishboxStats.updateMany({
            where: {
              userId: userId,
              eventId: request.eventId,
            },
            data: {
              totalParticipated: { increment: 1 },
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          // Log error but don't fail the post creation
          logger.warn({
            message: 'Failed to update event stats',
            eventId: request.eventId,
            userId,
            postId: post.id,
            error,
          });
        }
      }

      logger.info(`Free post created: ${post.id} by user ${userId}`, {
        eventId: request.eventId || null,
        contextType: request.contextType,
        contextId: actualContextId,
        inventoryId: request.inventoryId || null,
      });
      
      // Event cache'i invalidate et (eventId varsa)
      if (request.eventId) {
        this.eventService.invalidateEventCaches(request.eventId, userId).catch((err) => {
          logger.warn({ message: 'Failed to invalidate event caches', eventId: request.eventId, error: err });
        });
        
        // Event metrik ve badge kontrolü (async, hata olsa bile devam et)
        this.eventMetricsService.incrementUserPostCount(userId, request.eventId)
          .then((metrics) => {
            return this.badgeEligibilityService.checkAndGrantEventBadges(userId, request.eventId!, metrics);
          })
          .catch((err) => {
            logger.warn({ message: 'Failed to update event metrics or check badges', userId, eventId: request.eventId, error: err });
          });
      }
      
      // Catalog posts cache'ini invalidate et
      invalidateCatalogPostsCache({
        subCategoryId: contextIds.subCategoryId,
        productGroupId: contextIds.productGroupId,
        productId: contextIds.productId,
      }).catch((err) => {
        logger.warn({ message: 'Failed to invalidate catalog posts cache', error: err });
      });
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Post created successfully',
        success: true
      };
    } catch (error) {
      logger.error(`Failed to create free post:`, error);
      throw error;
    }
  }

  /**
   * Event membership validation - kullanıcı event'e katılmış mı?
   */
  private async validateEventMembership(userId: string, eventId: string): Promise<void> {
    const userStats = await this.prisma.wishboxStats.findUnique({
      where: {
        userId_eventId: {
          userId: userId,
          eventId: eventId,
        },
      },
    });

    if (!userStats) {
      throw new Error('You must join this event before sharing a post');
    }
  }

  /**
   * InventoryId'den ProductId'yi çeker
   * ✅ YENİ: App inventoryId gönderdiğinde productId'yi buradan çekiyoruz
   */
  private async resolveProductIdFromInventory(
    inventoryId: string,
    userId: string
  ): Promise<string> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: { 
        productId: true,
        userId: true 
      },
    });

    if (!inventory) {
      logger.warn({
        message: 'Inventory not found',
        inventoryId,
        userId,
      });
      throw new Error('Inventory item not found. Please select a valid product from your inventory.');
    }

    // Security: Inventory kullanıcıya ait mi kontrol et
    if (inventory.userId !== userId) {
      logger.warn({
        message: 'Inventory ownership mismatch',
        inventoryId,
        inventoryUserId: inventory.userId,
        requestUserId: userId,
      });
      throw new Error('This inventory item does not belong to you.');
    }

    logger.info({
      message: 'ProductId resolved from inventoryId',
      inventoryId,
      productId: inventory.productId,
      userId,
    });

    return inventory.productId;
  }

  /**
   * İpucu gönderisi oluştur
   */
  async createTipsAndTricksPost(
    userId: string,
    request: CreateTipsAndTricksPostRequest
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // Context validation
      if (
        request.contextType !== ContextType.SUB_CATEGORY &&
        request.contextType !== ContextType.PRODUCT_GROUP &&
        request.contextType !== ContextType.PRODUCT
      ) {
        throw new Error(
          'Tips and tricks posts can only be created for sub_category, product_group, or product'
        );
      }

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        request.contextId
      );

      const bodyWithImages = this.appendImagesToBody(
        request.description,
        request.images
      );

      // Map benefit category to tip category
      const tipCategory = this.mapBenefitCategoryToTipCategory(
        request.benefitCategory
      );

      const post = await this.postRepo.create(
        userId,
        ContentPostType.TIPS,
        '',
        bodyWithImages,
        contextIds.subCategoryId,
        contextIds.mainCategoryId,
        contextIds.productGroupId,
        contextIds.productId,
        false,
        false,
        request.eventId // eventId
      );

      // Create PostTip
      await this.tipRepo.create(
        post.id, // post.id is already a string (VarChar(26))
        tipCategory,
        false // isVerified - can be verified later
      );

      // Görselleri PostMedia'ya kaydet (orderIndex ile sıralı)
      if (request.images && request.images.length > 0) {
        await this.prisma.postMedia.createMany({
          data: request.images.map((imageUrl, index) => ({
            postId: post.id,
            userId: userId,
            mediaUrl: imageUrl,
            orderIndex: index, // Kullanıcının yüklediği sırada
          })),
        });
      }

      logger.info(
        `Tips and tricks post created: ${post.id} by user ${userId}`
      );
      
      // Event cache'i invalidate et (eventId varsa)
      if (request.eventId) {
        this.eventService.invalidateEventCaches(request.eventId, userId).catch((err) => {
          logger.warn({ message: 'Failed to invalidate event caches', eventId: request.eventId, error: err });
        });
        
        // Event metrik ve badge kontrolü (async, hata olsa bile devam et)
        this.eventMetricsService.incrementUserPostCount(userId, request.eventId)
          .then((metrics) => {
            return this.badgeEligibilityService.checkAndGrantEventBadges(userId, request.eventId!, metrics);
          })
          .catch((err) => {
            logger.warn({ message: 'Failed to update event metrics or check badges', userId, eventId: request.eventId, error: err });
          });
      }
      
      // Catalog posts cache'ini invalidate et
      invalidateCatalogPostsCache({
        subCategoryId: contextIds.subCategoryId,
        productGroupId: contextIds.productGroupId,
        productId: contextIds.productId,
      }).catch((err) => {
        logger.warn({ message: 'Failed to invalidate catalog posts cache', error: err });
      });
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Tips & tricks post başarıyla oluşturuldu',
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to create tips and tricks post:`, error);
      throw error;
    }
  }

  /**
   * Benefit category'yi tip category'ye map eder
   */
  private mapBenefitCategoryToTipCategory(
    benefitCategory: TipsAndTricksBenefitCategory
  ): TipCategory {
    // Default mapping - can be customized
    switch (benefitCategory) {
      case TipsAndTricksBenefitCategory.TIME:
      case TipsAndTricksBenefitCategory.ENERGY:
        return TipCategory.USAGE;
      case TipsAndTricksBenefitCategory.DURABILITY:
        return TipCategory.CARE;
      case TipsAndTricksBenefitCategory.BETTER:
        return TipCategory.OTHER;
      default:
        return TipCategory.OTHER;
    }
  }

  /**
   * Soru gönderisi oluştur
   */
  async createQuestionPost(
    userId: string,
    request: CreateQuestionPostRequest
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // Context validation
      if (
        request.contextType !== ContextType.SUB_CATEGORY &&
        request.contextType !== ContextType.PRODUCT_GROUP &&
        request.contextType !== ContextType.PRODUCT
      ) {
        throw new Error(
          'Question posts can only be created for sub_category, product_group, or product'
        );
      }

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        request.contextId
      );

      const bodyWithImages = this.appendImagesToBody(
        request.description,
        request.images
      );

      // Boost option validation
      const boostOption = await this.getBoostOption(
        request.selectedBoostOptionId
      );
      if (!boostOption) {
        throw new Error(`Boost option not found: ${request.selectedBoostOptionId}`);
      }

      const post = await this.postRepo.create(
        userId,
        ContentPostType.QUESTION,
        '',
        bodyWithImages,
        contextIds.subCategoryId,
        contextIds.mainCategoryId,
        contextIds.productGroupId,
        contextIds.productId,
        false,
        true, // isBoosted - question posts are boosted
        request.eventId // eventId
      );

      // Set boosted until date (e.g., 7 days from now)
      const boostedUntil = new Date();
      boostedUntil.setDate(boostedUntil.getDate() + 7);
      await this.postRepo.update(post.id, {
        boostedUntil,
      });

      // Create PostQuestion
      await this.questionRepo.create(
        post.id, // post.id is already a string (VarChar(26))
        QuestionAnswerFormat.SHORT, // Default format
        undefined // relatedProductId
      );

      // Görselleri PostMedia'ya kaydet (orderIndex ile sıralı)
      if (request.images && request.images.length > 0) {
        await this.prisma.postMedia.createMany({
          data: request.images.map((imageUrl, index) => ({
            postId: post.id,
            userId: userId,
            mediaUrl: imageUrl,
            orderIndex: index, // Kullanıcının yüklediği sırada
          })),
        });
      }

      logger.info(`Question post created: ${post.id} by user ${userId}`);
      
      // Event cache'i invalidate et (eventId varsa)
      if (request.eventId) {
        this.eventService.invalidateEventCaches(request.eventId, userId).catch((err) => {
          logger.warn({ message: 'Failed to invalidate event caches', eventId: request.eventId, error: err });
        });
        
        // Event metrik ve badge kontrolü (async, hata olsa bile devam et)
        this.eventMetricsService.incrementUserPostCount(userId, request.eventId)
          .then((metrics) => {
            return this.badgeEligibilityService.checkAndGrantEventBadges(userId, request.eventId!, metrics);
          })
          .catch((err) => {
            logger.warn({ message: 'Failed to update event metrics or check badges', userId, eventId: request.eventId, error: err });
          });
      }
      
      // Catalog posts cache'ini invalidate et
      invalidateCatalogPostsCache({
        subCategoryId: contextIds.subCategoryId,
        productGroupId: contextIds.productGroupId,
        productId: contextIds.productId,
      }).catch((err) => {
        logger.warn({ message: 'Failed to invalidate catalog posts cache', error: err });
      });
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Question post başarıyla oluşturuldu',
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to create question post:`, error);
      throw error;
    }
  }

  /**
   * Boost option getir
   */
  async getBoostOption(boostOptionId: string): Promise<BoostOption | null> {
    try {
      const boostOption = await this.prisma.boostOption.findUnique({
        where: { 
          id: boostOptionId,
          isActive: true 
        },
      });

      if (!boostOption) {
        return null;
      }

      return {
        id: boostOption.id,
        image: boostOption.image || '',
        title: boostOption.title,
        description: boostOption.description || '',
        amount: boostOption.amount,
        isPopular: boostOption.isPopular,
      };
    } catch (error) {
      logger.error(`Failed to get boost option: ${boostOptionId}`, error);
      throw error;
    }
  }

  /**
   * Boost option listesi getir
   */
  async getBoostOptions(): Promise<BoostOption[]> {
    return withCache(
      'post:boost-options:all',
      async () => {
        const boostOptions = await this.prisma.boostOption.findMany({
          where: { isActive: true },
          orderBy: [
            { isPopular: 'desc' },
            { amount: 'asc' },
          ],
        });

        return boostOptions.map((option) => ({
          id: option.id,
          image: option.image || '',
          title: option.title,
          description: option.description || '',
          amount: option.amount,
          isPopular: option.isPopular,
        }));
      },
      CACHE_TTL.LONG, // 1 saat - boost options nadiren değişir
      { logPrefix: 'PostService' }
    );
  }

  /**
   * Karşılaştırma gönderisi oluştur
   */
  async createBenchmarkPost(
    userId: string,
    request: CreateBenchmarkPostRequest
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // Benchmark posts can only be created for products
      if (request.contextType !== ContextType.PRODUCT) {
        throw new Error('Benchmark posts can only be created for products');
      }

      // Validate that products is an array
      if (!Array.isArray(request.products)) {
        logger.error('Products is not an array in createBenchmarkPost', {
          type: typeof request.products,
          products: request.products,
          requestKeys: Object.keys(request),
        });
        throw new Error(`products must be an array, got: ${typeof request.products}`);
      }

      // Validate that at least 2 products are selected
      const selectedProducts = request.products.filter((p) => p.isSelected);
      if (selectedProducts.length < 2) {
        throw new Error('At least 2 products must be selected for comparison');
      }

      // For now, we'll compare the first 2 selected products
      const product1 = selectedProducts[0];
      const product2 = selectedProducts[1];

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        request.contextId
      );

      const post = await this.postRepo.create(
        userId,
        ContentPostType.COMPARE,
        '',
        request.description,
        contextIds.subCategoryId,
        contextIds.mainCategoryId,
        contextIds.productGroupId,
        contextIds.productId,
        false,
        false,
        request.eventId // eventId
      );

      // Create PostComparison
      await this.comparisonRepo.create(
        post.id, // post.id is already a string (VarChar(26))
        product1.productId, // productId is already a string (UUID)
        product2.productId // productId is already a string (UUID)
      );

      // Görselleri PostMedia'ya kaydet (orderIndex ile sıralı)
      if (request.images && request.images.length > 0) {
        await this.prisma.postMedia.createMany({
          data: request.images.map((imageUrl, index) => ({
            postId: post.id,
            userId: userId,
            mediaUrl: imageUrl,
            orderIndex: index, // Kullanıcının yüklediği sırada
          })),
        });
      }

      logger.info(`Benchmark post created: ${post.id} by user ${userId}`);
      
      // Event cache'i invalidate et (eventId varsa)
      if (request.eventId) {
        this.eventService.invalidateEventCaches(request.eventId, userId).catch((err) => {
          logger.warn({ message: 'Failed to invalidate event caches', eventId: request.eventId, error: err });
        });
        
        // Event metrik ve badge kontrolü (async, hata olsa bile devam et)
        this.eventMetricsService.incrementUserPostCount(userId, request.eventId)
          .then((metrics) => {
            return this.badgeEligibilityService.checkAndGrantEventBadges(userId, request.eventId!, metrics);
          })
          .catch((err) => {
            logger.warn({ message: 'Failed to update event metrics or check badges', userId, eventId: request.eventId, error: err });
          });
      }
      
      // Catalog posts cache'ini invalidate et
      invalidateCatalogPostsCache({
        subCategoryId: contextIds.subCategoryId,
        productGroupId: contextIds.productGroupId,
        productId: contextIds.productId,
      }).catch((err) => {
        logger.warn({ message: 'Failed to invalidate catalog posts cache', error: err });
      });
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Benchmark post başarıyla oluşturuldu',
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to create benchmark post:`, error);
      throw error;
    }
  }

  /**
   * Deneyim paylaşımı gönderisi oluştur
   */
  async createExperiencePost(
    userId: string,
    request: CreateExperiencePostRequest
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // Experience posts can only be created for products
      if (request.contextType !== ContextType.PRODUCT) {
        throw new Error('Experience posts can only be created for products');
      }

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        request.contextId
      );

      if (!contextIds.productId) {
        throw new Error('Product ID is required for experience posts');
      }

      // I owned ise ürünü kullanıcı envanterine ekle/güncelle (görseli ile); I tried ise envantere ekleme
      const hasOwned = request.status === ExperienceStatus.OWN;
      if (hasOwned) {
        const inventory = await this.prisma.inventory.upsert({
          where: {
            userId_productId: {
              userId,
              productId: contextIds.productId,
            },
          },
          create: {
            userId,
            productId: contextIds.productId,
            hasOwned: true,
            experienceSummary: request.content?.slice(0, 500) || null,
            experienceSnippetId: request.experienceSnippetId || null,
            experienceDurationId: request.selectedDurationId || null,
            experienceLocationId: request.selectedLocationId || null,
            experiencePurposeId: request.selectedPurposeId || null,
          },
          update: {
            hasOwned: true,
            experienceSummary: request.content?.slice(0, 500) || undefined,
            experienceSnippetId: request.experienceSnippetId || undefined,
            experienceDurationId: request.selectedDurationId ?? undefined,
            experienceLocationId: request.selectedLocationId ?? undefined,
            experiencePurposeId: request.selectedPurposeId ?? undefined,
          },
        });
        inventoryId = inventory.id;
        // Post görsellerini envanter kaydına da ekle (ürün envanterde görseli ile görünsün)
        if (request.images && request.images.length > 0) {
          await this.prisma.inventoryMedia.createMany({
            data: request.images.map((mediaUrl) => ({
              inventoryId: inventory.id,
              mediaUrl,
            })),
          });
        }
        logger.info({
          message: 'Inventory upserted for experience post (I owned)',
          userId,
          productId: contextIds.productId,
          inventoryId: inventory.id,
          mediaCount: request.images?.length ?? 0,
        });
      }

      // Gönderi etiketi: I owned -> own, I tried -> tried
      const productStatus: 'own' | 'tried' = hasOwned ? 'own' : 'tried';

      // Combine content and experiences
      const experienceText = request.experience
        .map(
          (exp) =>
            `[${exp.type}] ${exp.content} (Rating: ${exp.rating}/5)`
        )
        .join('\n\n');
      const statusInfo = `[Status: ${request.status}]`;
      const fullBody = `${request.content}\n\n${statusInfo}\n\n${experienceText}`;

      const bodyWithImages = this.appendImagesToBody(fullBody, request.images);

      const post = await this.postRepo.create(
        userId,
        ContentPostType.EXPERIENCE,
        '',
        bodyWithImages,
        contextIds.subCategoryId,
        contextIds.mainCategoryId,
        contextIds.productGroupId,
        contextIds.productId,
        true, // inventoryRequired - experience posts require inventory
        false,
        request.eventId, // eventId
        productStatus // I owned / I tried etiketi
      );

      // AI Split ID ve Taxonomy ID'leri kaydet
      // Router'da zaten resolve edilmiş UUID'ler geliyor
      await this.prisma.contentPost.update({
        where: { id: post.id },
        data: { 
          experienceSnippetId: request.experienceSnippetId || null,
          experienceDurationId: request.selectedDurationId || null,
          experienceLocationId: request.selectedLocationId || null,
          experiencePurposeId: request.selectedPurposeId || null,
          eventId: request.eventId || null,
        }
      });

      // Görselleri PostMedia'ya kaydet (orderIndex ile sıralı)
      if (request.images && request.images.length > 0) {
        await this.prisma.postMedia.createMany({
          data: request.images.map((imageUrl, index) => ({
            postId: post.id,
            userId: userId,
            mediaUrl: imageUrl,
            orderIndex: index, // Kullanıcının yüklediği sırada
          })),
        });
      }

      logger.info(`Experience post created: ${post.id} by user ${userId}`, {
        experienceSnippetId: request.experienceSnippetId || null
      });

      // Achievement Ladder progress (event dışı) - async
      this.achievementProgressService
        .incrementProgress(userId, AchievementGoalType.POST, 1)
        .catch((err) => {
          logger.warn({
            message: 'Failed to increment achievement progress for experience post',
            userId,
            postId: post.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      
      // Event cache'i invalidate et (eventId varsa)
      if (request.eventId) {
        this.eventService.invalidateEventCaches(request.eventId, userId).catch((err) => {
          logger.warn({ message: 'Failed to invalidate event caches', eventId: request.eventId, error: err });
        });
        
        // Event metrik ve badge kontrolü (async, hata olsa bile devam et)
        this.eventMetricsService.incrementUserPostCount(userId, request.eventId)
          .then((metrics) => {
            return this.badgeEligibilityService.checkAndGrantEventBadges(userId, request.eventId!, metrics);
          })
          .catch((err) => {
            logger.warn({ message: 'Failed to update event metrics or check badges', userId, eventId: request.eventId, error: err });
          });
      }
      
      // Catalog posts cache'ini invalidate et (product feed güncel dönsün diye await)
      await invalidateCatalogPostsCache({
        subCategoryId: contextIds.subCategoryId,
        productGroupId: contextIds.productGroupId,
        productId: contextIds.productId,
      }).catch((err) => {
        logger.warn({ message: 'Failed to invalidate catalog posts cache', error: err });
      });
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Experience post başarıyla oluşturuldu',
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to create experience post:`, error);
      throw error;
    }
  }

  /**
   * AI ile deneyimi ayır ve database'e kaydet
   */
  async splitExperience(
    request: SplitExperienceRequest
  ): Promise<SplitExperienceResponse> {
    try {
      // Ürün bilgilerini al
      const product = await this.prisma.product.findUnique({
        where: { id: request.productId },
        include: {
          brand: true,
        },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Gemini AI ile deneyimi ayır
      const splitResult = await this.geminiService.splitExperience({
        productId: request.productId,
        productName: product.name,
        productBrand: product.brand?.name || undefined,
        productDescription: product.description || undefined,
        experienceText: request.content,
      });

      // AI split sonucunu database'e kaydet
      const experienceSnippet = await this.experienceSnippetRepo.create({
        userId: request.userId,
        productId: request.productId,
        originalExperience: request.content,
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
      });

      logger.info({
        message: 'Experience split with AI and saved',
        userId: request.userId,
        productId: request.productId,
        experienceSnippetId: experienceSnippet.id,
        tokensUsed: splitResult.metadata.tokensUsed,
        processingTimeMs: splitResult.metadata.processingTimeMs,
        hasPriceAndShopping: !!splitResult.priceAndShopping?.content,
        hasProductAndUsage: !!splitResult.productAndUsage?.content,
      });

      return {
        experienceSnippetId: experienceSnippet.id,
        priceAndShopping: splitResult.priceAndShopping,
        productAndUsage: splitResult.productAndUsage,
        metadata: splitResult.metadata,
      };
    } catch (error) {
      logger.error(`Failed to split experience:`, error);
      throw error;
    }
  }

  /**
   * Güncelleme gönderisi oluştur
   */
  async createUpdatePost(
    userId: string,
    request: CreateUpdatePostRequest
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // Update posts can only be created for products
      if (request.contextType !== ContextType.PRODUCT) {
        throw new Error('Update posts can only be created for products');
      }

      // Experience post validation - update posts can only be created on experience posts
      if (!request.experiencePostId) {
        throw new Error('experiencePostId is required for update posts');
      }

      const experiencePost = await this.prisma.contentPost.findUnique({
        where: { id: request.experiencePostId },
        select: { id: true, userId: true, type: true, productId: true },
      });

      if (!experiencePost) {
        throw new Error('Experience post not found');
      }

      if (experiencePost.userId !== userId) {
        throw new Error('You can only create update posts on your own experience posts');
      }

      if (experiencePost.type !== ContentPostType.EXPERIENCE) {
        throw new Error('Update posts can only be created on experience posts');
      }

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        request.contextId
      );

      // Verify that the experience post is for the same product
      if (experiencePost.productId !== contextIds.productId) {
        throw new Error('Experience post and update post must be for the same product');
      }

      const bodyWithImages = this.appendImagesToBody(
        request.content,
        request.images
      );

      const post = await this.postRepo.create(
        userId,
        ContentPostType.UPDATE,
        '',
        bodyWithImages,
        contextIds.subCategoryId,
        contextIds.mainCategoryId,
        contextIds.productGroupId,
        contextIds.productId,
        true, // inventoryRequired - update posts require inventory
        false,
        request.eventId // eventId
      );

      // Create PostUpdateContent record
      await this.prisma.postUpdateContent.create({
        data: {
          postId: post.id,
          experiencePostId: request.experiencePostId,
          content: request.content,
        },
      });

      // Görselleri PostMedia'ya kaydet (orderIndex ile sıralı)
      if (request.images && request.images.length > 0) {
        await this.prisma.postMedia.createMany({
          data: request.images.map((imageUrl, index) => ({
            postId: post.id,
            userId: userId,
            mediaUrl: imageUrl,
            orderIndex: index, // Kullanıcının yüklediği sırada
          })),
        });
      }

      logger.info(`Update post created: ${post.id} by user ${userId} for experience post ${request.experiencePostId}`);
      
      // Event cache'i invalidate et (eventId varsa)
      if (request.eventId) {
        this.eventService.invalidateEventCaches(request.eventId, userId).catch((err) => {
          logger.warn({ message: 'Failed to invalidate event caches', eventId: request.eventId, error: err });
        });
        
        // Event metrik ve badge kontrolü (async, hata olsa bile devam et)
        this.eventMetricsService.incrementUserPostCount(userId, request.eventId)
          .then((metrics) => {
            return this.badgeEligibilityService.checkAndGrantEventBadges(userId, request.eventId!, metrics);
          })
          .catch((err) => {
            logger.warn({ message: 'Failed to update event metrics or check badges', userId, eventId: request.eventId, error: err });
          });
      }
      
      // Catalog posts cache'ini invalidate et
      invalidateCatalogPostsCache({
        subCategoryId: contextIds.subCategoryId,
        productGroupId: contextIds.productGroupId,
        productId: contextIds.productId,
      }).catch((err) => {
        logger.warn({ message: 'Failed to invalidate catalog posts cache', error: err });
      });
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Update post başarıyla oluşturuldu',
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to create update post:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının ürün için review bilgilerini getir
   */
  async getUserProductReviews(
    userId: string,
    productId: string
  ): Promise<any[]> {
    try {
      // Get user's inventory for the product
      const inventory = await this.prisma.inventory.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        include: {
          media: true,
        },
      });

      if (!inventory) {
        return [];
      }

      // Return review information
      return [
        {
          inventoryId: inventory.id,
          hasOwned: inventory.hasOwned,
          experienceSummary: inventory.experienceSummary,
          experiences: [], // ProductExperience modeli artık kullanılmıyor
          media: inventory.media.map((m) => ({
            id: m.id,
            mediaUrl: m.mediaUrl,
          })),
        },
      ];
    } catch (error) {
      logger.error(
        `Failed to get user product reviews: ${userId}, ${productId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Experience option name'lerini UUID'lere çevir
   * UUID formatında olmayan değerler için database'de lookup yapar
   */
  async resolveExperienceOptionIds(params: {
    durationId?: string | null;
    locationId?: string | null;
    purposeId?: string | null;
  }): Promise<{
    durationId: string | null;
    locationId: string | null;
    purposeId: string | null;
  }> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Eğer tüm değerler UUID formatındaysa, direkt döndür
    if (
      (!params.durationId || uuidRegex.test(params.durationId)) &&
      (!params.locationId || uuidRegex.test(params.locationId)) &&
      (!params.purposeId || uuidRegex.test(params.purposeId))
    ) {
      return {
        durationId: params.durationId || null,
        locationId: params.locationId || null,
        purposeId: params.purposeId || null,
      };
    }

    // Lookup gerekiyor
    const options = await this.getExperienceOptions();
    
    const resolveOption = <T extends { id: string; name: string }>(
      value: string | null | undefined,
      options: T[],
      type: 'duration' | 'location' | 'purpose'
    ): string | null => {
      if (!value) return null;
      
      // UUID formatındaysa direkt döndür
      if (uuidRegex.test(value)) {
        return value;
      }

      // Name-based lookup
      const normalizedInput = value.trim().toLowerCase();
      
      // Exact match
      let found = options.find(opt => {
        const normalizedName = opt.name.trim().toLowerCase();
        return normalizedName === normalizedInput || opt.id === value;
      });

      // Partial match (sadece duration için sayı eşleşmesi)
      if (!found && type === 'duration') {
        found = options.find(opt => {
          const normalizedName = opt.name.trim().toLowerCase();
          const inputNumber = normalizedInput.match(/\d+/)?.[0];
          const nameNumber = normalizedName.match(/\d+/)?.[0];
          
          return normalizedName.includes(normalizedInput) ||
                 normalizedInput.includes(normalizedName) ||
                 (inputNumber && nameNumber && inputNumber === nameNumber);
        });
      } else if (!found) {
        // Location ve Purpose için partial match
        found = options.find(opt => {
          const normalizedName = opt.name.trim().toLowerCase();
          return normalizedName.includes(normalizedInput) ||
                 normalizedInput.includes(normalizedName);
        });
      }

      if (found) {
        logger.info(`Experience ${type} resolved`, {
          provided: value,
          resolved: found.name,
          id: found.id,
        });
        return found.id;
      }

      logger.warn(`Experience ${type} not found`, {
        provided: value,
        available: options.map(opt => opt.name),
      });
      
      return null;
    };

    return {
      durationId: resolveOption(params.durationId, options.durations, 'duration'),
      locationId: resolveOption(params.locationId, options.locations, 'location'),
      purposeId: resolveOption(params.purposeId, options.purposes, 'purpose'),
    };
  }

  /**
   * Duration, Location, Purpose seçeneklerini getir
   */
  async getExperienceOptions(): Promise<{
    durations: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
    purposes: Array<{ id: string; name: string }>;
  }> {
    try {
      const [durations, locations, purposes] = await Promise.all([
        this.prisma.experienceDuration.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.experienceLocation.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.experiencePurpose.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      return {
        durations: durations.map((d) => ({ id: d.id, name: d.name })),
        locations: locations.map((l) => ({ id: l.id, name: l.name })),
        purposes: purposes.map((p) => ({ id: p.id, name: p.name })),
      };
    } catch (error) {
      logger.error('Failed to get experience options', error);
      throw error;
    }
  }

  /**
   * Gönderi sil
   * - Sadece gönderi sahibi silebilir
   * - İlişkili kayıtlar FK ile otomatik temizlenir (post_tips, post_questions, post_comparisons vb.)
   */
  /**
   * Post ID'sine göre post detayını getirir
   */
  async getPostById(postId: string): Promise<any> {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      include: {
        user: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            titles: {
              orderBy: { earnedAt: 'desc' },
              take: 1,
            },
          },
        },
        product: {
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
        },
        productGroup: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
        subCategory: {
          include: {
            mainCategory: true,
          },
        },
        mainCategory: true,
        comparison: {
          include: {
            product1: {
              include: {
                group: true,
              },
            },
            product2: {
              include: {
                group: true,
              },
            },
            scores: true,
          },
        },
        question: true,
        tip: true,
        tags: true,
        likes: true,
        comments: {
          include: {
            user: {
              include: {
                profile: true,
                avatars: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        favorites: true,
        contentPostTags: true,
        media: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!post) {
      return null;
    }

    // FeedService kullanarak post'u feed formatına çevir
    const feedItem = await this.feedService.getPostAsFeedItem(post);
    return feedItem?.data || null;
  }

  /**
   * Post güncelleme
   */
  async updatePost(
    userId: string,
    postId: string,
    request: UpdatePostRequest
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      const post = await this.postRepo.findById(postId);

      if (!post) {
        throw new Error('Post not found');
      }

      if (!post.belongsToUser(userId)) {
        throw new Error('Forbidden: user does not own this post');
      }

      // Post'un mevcut eventId'sini al (cache invalidation için)
      const postWithEvent = await this.prisma.contentPost.findUnique({
        where: { id: postId },
        select: { eventId: true },
      });
      const oldEventId = postWithEvent?.eventId || null;

      // Event validation (eğer yeni eventId verilmişse)
      if (request.eventId && request.eventId !== oldEventId) {
        await this.validateEvent(request.eventId);
      }

      // Body güncelleme
      let updatedBody = post.body;
      if (request.description !== undefined) {
        updatedBody = this.appendImagesToBody(request.description, request.images);
      }

      // Post'u güncelle (Prisma ile direkt, çünkü eventId field'ı repository'de yok)
      const updateData: any = {};
      if (request.description !== undefined) {
        updateData.body = updatedBody;
      }
      if (request.eventId !== undefined) {
        updateData.eventId = request.eventId || null;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.contentPost.update({
          where: { id: postId },
          data: updateData,
        });
      }

      // Görselleri güncelle
      if (request.images !== undefined) {
        // Mevcut görselleri al
        const existingMedia = await this.prisma.postMedia.findMany({
          where: { postId },
          orderBy: { orderIndex: 'asc' },
        });

        // Eski görselleri S3'ten sil
        for (const media of existingMedia) {
          try {
            await this.s3Service.deleteFile(media.mediaUrl);
          } catch (error) {
            logger.warn({
              message: 'Failed to delete old image from S3',
              mediaUrl: media.mediaUrl,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Eski görselleri veritabanından sil
        await this.prisma.postMedia.deleteMany({
          where: { postId },
        });

        // Yeni görselleri ekle
        if (request.images.length > 0) {
          await this.prisma.postMedia.createMany({
            data: request.images.map((imageUrl, index) => ({
              postId: postId,
              userId: userId,
              mediaUrl: imageUrl,
              orderIndex: index,
            })),
          });
        }
      }

      logger.info(`Post updated: ${postId} by user ${userId}`);

      // Event cache'i invalidate et (eski veya yeni eventId varsa)
      const newEventId = request.eventId || oldEventId;
      if (newEventId) {
        this.eventService.invalidateEventCaches(newEventId, userId).catch((err) => {
          logger.warn({
            message: 'Failed to invalidate event caches',
            eventId: newEventId,
            error: err,
          });
        });
      }

      // Feed cache'lerini invalidate et (tüm kullanıcılar için)
      // Feed cache pattern: feed:userId:cursor:limit
      try {
        const cacheService = CacheService.getInstance();
        await cacheService.delPattern('feed:*').catch(() => {});
      } catch (error) {
        logger.warn({
          message: 'Failed to invalidate feed cache',
          postId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return {
        id: postId,
        message: 'Post başarıyla güncellendi',
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to update post ${postId} by user ${userId}`, error);
      throw error;
    }
  }

  async deletePost(userId: string, postId: string): Promise<boolean> {
    try {
      const post = await this.postRepo.findById(postId?.trim() || '');

      if (!post) {
        return false; // Router 404 dönecek
      }

      if (!post.belongsToUser(userId)) {
        throw new Error('Forbidden: user does not own this post');
      }

      // Post'un eventId'sini al (cache invalidation için) - Prisma'dan direkt çek
      const postWithEvent = await this.prisma.contentPost.findUnique({
        where: { id: postId },
        select: { eventId: true }
      });
      const eventId = postWithEvent?.eventId || null;

      const deleted = await this.postRepo.delete(postId);

      if (deleted) {
        logger.info(`Post deleted: ${postId} by user ${userId}`);
        
        // Event cache'i invalidate et (eventId varsa)
        if (eventId) {
          this.eventService.invalidateEventCaches(eventId, userId).catch((err) => {
            logger.warn({ message: 'Failed to invalidate event caches', eventId, error: err });
          });
        }
      } else {
        logger.warn(`Post delete returned false for id: ${postId}`);
      }

      return deleted;
    } catch (error) {
      logger.error(`Failed to delete post ${postId} by user ${userId}`, error);
      throw error;
    }
  }
}

