import { ContentPostPrismaRepository } from '../../infrastructure/repositories/content-post-prisma.repository';
import { PostTipPrismaRepository } from '../../infrastructure/repositories/post-tip-prisma.repository';
import { PostQuestionPrismaRepository } from '../../infrastructure/repositories/post-question-prisma.repository';
import { PostComparisonPrismaRepository } from '../../infrastructure/repositories/post-comparison-prisma.repository';
import { ContentPost } from '../../domain/content/content-post.entity';
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
  BoostOption,
  GetBoostPriceResponse,
  SplitExperienceRequest,
  SplitExperienceResponse,
  Experience,
} from '../../interfaces/post/post.dto';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { FeedService } from '../feed/feed.service';
import logger from '../../infrastructure/logger/logger';
import { GeminiService } from '../../infrastructure/ai/gemini.service';
import { AIPipelineLogger } from '../../infrastructure/ai/ai-pipeline-logger';
import { AiExperienceSplitPrismaRepository } from '../../infrastructure/repositories/ai-experience-split-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { EventService } from '../event/event.service';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { invalidateCatalogPostsCache } from '../../infrastructure/cache/cache-invalidation';
import { EventMetricsService } from '../event/event-metrics.service';
import { BadgeEligibilityService } from '../gamification/badge-eligibility.service';
import { AchievementProgressService } from '../gamification/achievement-progress.service';
import { ActionLogService } from '../gamification/action-log.service';
import { MainAction } from '../../domain/gamification/main-action.enum';
import { IdResolverService } from '../../infrastructure/ids/id-resolver.service';
import { getErrorMessage } from '../../infrastructure/errors/error-helper';
import { WalletService } from '../wallet/wallet.service';
import { TransactionService } from '../transaction/transaction.service';
import { ValidationError } from '../../infrastructure/errors/custom-errors';
import { InventoryService } from '../inventory/inventory.service';
import { generateIdForModel } from '../../infrastructure/ids/id.strategy';

/**
 * Admin tarafından post oluşturulurken bazı kontrolleri atlamak için kullanılır.
 * PostService create method'larına opsiyonel parametre olarak geçilir.
 */
export interface AdminCreateOptions {
  /** Envanter kontrolünü atla (admin envanterde olmasa da OWN post oluşturabilsin) */
  skipInventoryCheck?: boolean;
  /** Event üyelik kontrolünü atla */
  skipEventMembershipCheck?: boolean;
  /** Boost için TIPS bakiye kontrolü ve kesintisini atla */
  skipBoostPayment?: boolean;
  /** Audit trail için admin kullanıcı ID'si */
  adminId?: string;
}

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
  private actionLogService: ActionLogService;
  private idResolver: IdResolverService;
  private walletService: WalletService;
  private transactionService: TransactionService;
  private inventoryService: InventoryService;

  /**
   * Search posts by title and body
   */
  async searchPosts(query: string, options?: { limit?: number; cursor?: string }): Promise<{
    items: ContentPost[];
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

  constructor(idResolver?: IdResolverService) {
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
    this.actionLogService = new ActionLogService();
    this.idResolver = idResolver ?? new IdResolverService();
    this.walletService = new WalletService();
    this.transactionService = new TransactionService();
    this.inventoryService = new InventoryService();
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

    const event = await this.prisma.event.findUnique({
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
  /** IdResolver'a delege eder; router ve diğer servisler bu metodu kullanabilir. */
  async resolveProductId(productIdOrExternalId: string): Promise<string> {
    return this.idResolver.resolveProductId(productIdOrExternalId);
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

    // UUID değilse: Category tablosunda id, externalId veya medusaId ile ara (pcat_, mcat_, scat_ vb.)
    try {
      const categoryResult = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name 
        FROM categories 
        WHERE id = ${trimmedId}
           OR metadata->>'externalId' = ${trimmedId}
           OR metadata->>'medusaId' = ${trimmedId}
        LIMIT 1
      `;

      if (categoryResult && categoryResult.length > 0) {
        const category = categoryResult[0];

        // Önce Category name ile ProductGroup'u bul
        let productGroup = await this.prisma.productGroup.findFirst({
          where: { name: category.name },
          select: { id: true },
        });

        // ProductGroup name ile bulunamadıysa (pcat_ = main category): MainCategory -> SubCategory -> ilk ProductGroup
        if (!productGroup) {
          const mainCategory = await this.prisma.mainCategory.findFirst({
            where: { name: category.name },
            select: { id: true },
          });
          if (mainCategory) {
            const subCategory = await this.prisma.subCategory.findFirst({
              where: { mainCategoryId: mainCategory.id },
              select: { id: true },
            });
            if (subCategory) {
              productGroup = await this.prisma.productGroup.findFirst({
                where: { subCategoryId: subCategory.id },
                select: { id: true },
              });
            }
          }
        }

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
    categoryId?: string;
    subCategoryId?: string;
    productGroupId?: string;
    productId?: string;
    mainCategoryId?: string;
  }> {
    switch (contextType) {
      case ContextType.SUB_CATEGORY:
        // Medusa modu: tek tablo (categories). contextId = categories.id
        const resolvedCategoryIdSub = await this.idResolver.resolveCategoryId(contextId);
        // ✅ Sadece categoryId döndür (prefix'li ID için - pcat_xxx)
        // subCategoryId UUID tipinde olduğu için prefix'li ID kabul etmiyor
        return { categoryId: resolvedCategoryIdSub };

      case ContextType.PRODUCT_GROUP:
        // Medusa modu: tek tablo (categories). contextId = categories.id (örn. pcat_xxx)
        const resolvedCategoryIdGroup = await this.idResolver.resolveCategoryId(contextId);
        // ✅ Sadece categoryId döndür (prefix'li ID için)
        return { categoryId: resolvedCategoryIdGroup };

      case ContextType.PRODUCT:
        // Product ayrı tabloda; resolveProductId + product ilişkileri
        const resolvedProductId = await this.idResolver.resolveProductId(contextId);
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
          logger.warn({
            message: 'Product not found in post creation',
            contextId,
            resolvedProductId,
          });
          throw new Error(`Product does not exist or has been deleted. Please select a valid product.`);
        }
        return {
          productId: resolvedProductId,
          categoryId: product.categoryId || undefined,
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
    request: CreatePostRequest,
    adminOptions?: AdminCreateOptions
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
        if (!adminOptions?.skipEventMembershipCheck) {
          await this.validateEventMembership(userId, request.eventId);
        }

        // ✅ ROASTS event'lerde productStatus beklenir (app own|tried gönderir)
        const event = await this.prisma.event.findUnique({
          where: { id: request.eventId },
          select: { feedType: true },
        });
        if (event?.feedType === 'ROASTS') {
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

      // ✅ Product context için envanter kontrolü
      // Event post'ları için kontrol YAPILMAZ (kullanıcılar event'lerde herhangi bir ürün hakkında içerik paylaşabilir)
      // Normal free post'lar için kontrol YAPILIR (sadece envanterindeki ürünler hakkında gönderi paylaşabilir)
      const isEventPost = !!request.eventId;

      if (request.contextType === ContextType.PRODUCT && contextIds.productId && !isEventPost && !adminOptions?.skipInventoryCheck) {
        const hasProduct = await this.inventoryService.hasProductInInventory(
          userId,
          contextIds.productId
        );

        if (!hasProduct) {
          logger.warn({
            message: 'User attempted to create free post for product not in inventory',
            userId,
            productId: contextIds.productId,
            contextType: request.contextType,
          });
          throw new ValidationError(
            'Bu ürün envanterinizde bulunmuyor. Gönderi oluşturmak için önce ürünü envanterinize eklemelisiniz.'
          );
        }
      }

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
        request.productStatus,
        contextIds.categoryId
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
          await this.prisma.eventStats.updateMany({
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

      // Collection badge progress (async, hata olsa bile devam et)
      this.achievementProgressService.incrementProgressByCode(
        userId,
        MainAction.POST,
        'FREE',
        1
      ).catch((err) => {
        logger.warn({ message: 'Failed to increment post achievement progress', userId, postId: post.id, error: err });
      });

      // Keyword-based badge progress (async, fire-and-forget)
      this.achievementProgressService
        .incrementKeywordProgress(userId, ContentPostType.FREE, request.description || '')
        .catch((err) => {
          logger.warn({ message: 'Failed to check keyword progress', userId, postId: post.id, error: getErrorMessage(err) });
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
    const userStats = await this.prisma.eventStats.findUnique({
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
    request: CreateTipsAndTricksPostRequest,
    adminOptions?: AdminCreateOptions
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

      // ✅ YENİ: Product context ise envanter kontrolü yap
      if (request.contextType === ContextType.PRODUCT && contextIds.productId && !adminOptions?.skipInventoryCheck) {
        const hasProduct = await this.inventoryService.hasProductInInventory(
          userId,
          contextIds.productId
        );

        if (!hasProduct) {
          logger.warn({
            message: 'User attempted to create tips post for product not in inventory',
            userId,
            productId: contextIds.productId,
          });
          throw new ValidationError(
            'Bu ürün envanterinizde bulunmuyor. İpucu paylaşmak için önce ürünü envanterinize eklemelisiniz.'
          );
        }
      }

      const bodyWithImages = this.appendImagesToBody(
        request.description,
        request.images
      );

      // Map benefit category to tip category
      const tipCategory = this.mapBenefitCategoryToTipCategory(
        request.benefitCategory
      );

      // Post, PostTip ve PostMedia atomic olarak olusturulmali
      const post = await this.prisma.$transaction(async (tx) => {
        const createdPost = await this.postRepo.create(
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
          request.eventId,
          undefined,
          contextIds.categoryId
        );

        // Create PostTip
        await tx.postTip.create({
          data: {
            postId: createdPost.id,
            tipCategory,
            isVerified: false,
          },
        });

        // Gorselleri PostMedia'ya kaydet (orderIndex ile sirali)
        if (request.images && request.images.length > 0) {
          await tx.postMedia.createMany({
            data: request.images.map((imageUrl, index) => ({
              postId: createdPost.id,
              userId: userId,
              mediaUrl: imageUrl,
              orderIndex: index,
            })),
          });
        }

        return createdPost;
      });

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

      // Collection badge progress (async, hata olsa bile devam et)
      this.achievementProgressService.incrementProgressByCode(
        userId,
        MainAction.POST,
        'TIPS',
        1
      ).catch((err) => {
        logger.warn({ message: 'Failed to increment post achievement progress', userId, postId: post.id, error: err });
      });

      // Keyword-based badge progress (async, fire-and-forget)
      this.achievementProgressService
        .incrementKeywordProgress(userId, ContentPostType.TIPS, request.description || '')
        .catch((err) => {
          logger.warn({ message: 'Failed to check keyword progress', userId, postId: post.id, error: getErrorMessage(err) });
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
   * Tekil boost fiyatı (TIPS). İleride onchain/yoğunluğa göre hesaplanacak; şimdilik base değer.
   */
  async getBoostPrice(): Promise<GetBoostPriceResponse> {
    const envPrice = process.env.BOOST_PRICE ? Number(process.env.BOOST_PRICE) : NaN;
    if (Number.isFinite(envPrice) && envPrice > 0) {
      return { price: envPrice, currency: 'TIPS' };
    }
    const options = await this.getBoostOptions();
    const price = options.length > 0 ? options[0].amount : 50;
    return {
      price,
      currency: 'TIPS',
      factors: { activityLevel: 'base' },
    };
  }

  /**
   * Soru gönderisi oluştur.
   * boostEnabled true ise: boost fiyatı kadar TIPS düşülür, post boost'lu oluşturulur (boostPrice kaydedilir).
   */
  async createQuestionPost(
    userId: string,
    request: CreateQuestionPostRequest,
    adminOptions?: AdminCreateOptions
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

      // ✅ Question posts do NOT require inventory check
      // Users can ask questions about products they don't own (and pay TIPS for boost)

      const bodyWithImages = this.appendImagesToBody(
        request.description,
        request.images
      );

      const boostEnabled = request.boostEnabled === true;
      let boostPrice: number | undefined;
      if (boostEnabled && !adminOptions?.skipBoostPayment) {
        const { price } = await this.getBoostPrice();
        const balanceInfo = await this.walletService.getUserBalance(userId);
        if (balanceInfo.available < price) {
          throw new ValidationError(
            `Insufficient TIPS balance. Available: ${balanceInfo.available} TIPS, required: ${price} TIPS`
          );
        }
        boostPrice = price;
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
        boostEnabled,
        request.eventId,
        undefined,
        contextIds.categoryId,
        boostPrice
      );

      if (boostEnabled && boostPrice != null && !adminOptions?.skipBoostPayment) {
        try {
          await this.transactionService.deductForPostBoost(userId, boostPrice, post.id);
        } catch (err) {
          await this.postRepo.update(post.id, { isBoosted: false, boostPrice: undefined });
          throw err;
        }
        const boostedUntil = new Date();
        boostedUntil.setDate(boostedUntil.getDate() + 7);
        await this.postRepo.update(post.id, { boostedUntil });
      } else if (boostEnabled && adminOptions?.skipBoostPayment) {
        // Admin boost: set boosted without payment
        const boostedUntil = new Date();
        boostedUntil.setDate(boostedUntil.getDate() + 7);
        await this.postRepo.update(post.id, { boostedUntil });
      }

      // Create PostQuestion
      await this.questionRepo.create(
        post.id,
        QuestionAnswerFormat.SHORT,
        undefined
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

      // Collection badge progress (async, hata olsa bile devam et)
      this.achievementProgressService.incrementProgressByCode(
        userId,
        MainAction.POST,
        'QUESTION',
        1
      ).catch((err) => {
        logger.warn({ message: 'Failed to increment post achievement progress', userId, postId: post.id, error: err });
      });

      // Keyword-based badge progress (async, fire-and-forget)
      this.achievementProgressService
        .incrementKeywordProgress(userId, ContentPostType.QUESTION, request.description || '')
        .catch((err) => {
          logger.warn({ message: 'Failed to check keyword progress', userId, postId: post.id, error: getErrorMessage(err) });
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
   * Post boost aç/kapa. Açarken bakiye kontrolü yapılır ve TIPS düşülür; kapatırken iade yok.
   */
  async togglePostBoost(
    postId: string,
    userId: string,
    enabled: boolean
  ): Promise<{ success: boolean; postId: string; isBoosted: boolean; boostPrice?: number; message?: string }> {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, type: true, isBoosted: true, boostPrice: true },
    });
    if (!post) {
      throw new Error('Post not found');
    }
    if (post.userId !== userId) {
      throw new Error('You can only change boost for your own post');
    }
    if (post.type !== ContentPostType.QUESTION) {
      throw new Error('Only question posts can be boosted');
    }

    if (enabled && !post.isBoosted) {
      const { price } = await this.getBoostPrice();
      const balanceInfo = await this.walletService.getUserBalance(userId);
      if (balanceInfo.available < price) {
        return {
          success: false,
          postId,
          isBoosted: false,
          message: `Insufficient TIPS balance. Available: ${balanceInfo.available} TIPS, required: ${price} TIPS`,
        };
      }
      await this.transactionService.deductForPostBoost(userId, price, postId);
      const boostedUntil = new Date();
      boostedUntil.setDate(boostedUntil.getDate() + 7);
      await this.postRepo.update(postId, { isBoosted: true, boostPrice: price, boostedUntil });
      return { success: true, postId, isBoosted: true, boostPrice: price };
    }

    if (!enabled && post.isBoosted) {
      await this.postRepo.update(postId, { isBoosted: false });
      return { success: true, postId, isBoosted: false };
    }

    return {
      success: true,
      postId,
      isBoosted: post.isBoosted,
      boostPrice: post.boostPrice ?? undefined,
    };
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
    request: CreateBenchmarkPostRequest,
    adminOptions?: AdminCreateOptions
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

      // Validate that there are at least 2 distinct products to compare
      if (request.products.length < 2) {
        throw new Error('At least 2 products are required for comparison');
      }

      // Compare the first 2 provided products (order = left/right in the UI)
      const product1 = request.products[0];
      const product2 = request.products[1];

      // Resolve the author's winner choice.
      // Priority: explicit choiceProductId, else the single product flagged isSelected.
      let choiceProductId: string | null = null;
      if (request.choiceProductId) {
        if (
          request.choiceProductId === product1.productId ||
          request.choiceProductId === product2.productId
        ) {
          choiceProductId = request.choiceProductId;
        }
      } else {
        const selected = request.products.filter((p) => p.isSelected);
        if (selected.length === 1) {
          choiceProductId = selected[0].productId;
        }
      }

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        request.contextId
      );

      // ✅ Ana ürün (context product) envanterde olmalı
      if (contextIds.productId && !adminOptions?.skipInventoryCheck) {
        const hasProduct = await this.inventoryService.hasProductInInventory(
          userId,
          contextIds.productId
        );

        if (!hasProduct) {
          logger.warn({
            message: 'User attempted to create benchmark post for product not in inventory',
            userId,
            productId: contextIds.productId,
          });
          throw new ValidationError(
            'Karşılaştırma yapmak istediğiniz ana ürün envanterinizde bulunmuyor. Lütfen önce ürünü envanterinize ekleyin.'
          );
        }
      }

      // ✅ Karşılaştırılacak 2. ürün için envanter kontrolü YOK
      // Kullanıcı envanterindeki bir ürünü herhangi bir ürünle karşılaştırabilir

      // Transaction: Post, Comparison ve Media kayıtlarını atomik olarak oluştur
      const post = await this.prisma.$transaction(async (tx) => {
        const postId = generateIdForModel('ContentPost');

        const createdPost = await tx.contentPost.create({
          data: {
            id: postId,
            userId,
            type: ContentPostType.COMPARE,
            title: '',
            body: request.description,
            subCategoryId: contextIds.subCategoryId || null,
            mainCategoryId: contextIds.mainCategoryId || null,
            productGroupId: contextIds.productGroupId || null,
            productId: contextIds.productId || null,
            categoryId: contextIds.categoryId || null,
            productStatus: null,
            inventoryRequired: false,
            isBoosted: false,
            eventId: request.eventId || null,
            boostPrice: null,
          },
        });

        // PostComparison oluştur
        await tx.postComparison.create({
          data: {
            postId: createdPost.id,
            product1Id: product1.productId,
            product2Id: product2.productId,
            choiceProductId: choiceProductId ?? null,
          },
        });

        // Görselleri PostMedia'ya kaydet (orderIndex ile sıralı)
        if (request.images && request.images.length > 0) {
          await tx.postMedia.createMany({
            data: request.images.map((imageUrl, index) => ({
              postId: createdPost.id,
              userId: userId,
              mediaUrl: imageUrl,
              orderIndex: index,
            })),
          });
        }

        // Kullanıcının post sayısını artır
        await tx.profile.updateMany({
          where: { userId },
          data: {
            postsCount: {
              increment: 1,
            },
          },
        });

        return createdPost;
      });

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

      // Keyword-based badge progress (async, fire-and-forget)
      this.achievementProgressService
        .incrementKeywordProgress(userId, ContentPostType.COMPARE, request.description || '')
        .catch((err) => {
          logger.warn({ message: 'Failed to check keyword progress', userId, postId: post.id, error: getErrorMessage(err) });
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
    request: CreateExperiencePostRequest,
    adminOptions?: AdminCreateOptions
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      // ✅ YENİ: Sub-category veya product-group context'inde de product ID verilmişse kabul et
      let contextIds: {
        categoryId?: string;
        subCategoryId?: string;
        productGroupId?: string;
        productId?: string;
        mainCategoryId?: string;
      };
      
      if (request.contextType === ContextType.PRODUCT) {
        // Product context - normal flow
        contextIds = await this.resolveContextIds(
          request.contextType,
          request.contextId
        );
      } else if (
        (request.contextType === ContextType.SUB_CATEGORY || 
         request.contextType === ContextType.PRODUCT_GROUP) &&
        request.productId
      ) {
        // Sub-category veya Product-group context + productId verilmiş
        // Bu durumda: context'ten category bilgilerini al, product'tan ürün bilgilerini al
        const categoryContextIds = await this.resolveContextIds(
          request.contextType,
          request.contextId
        );
        
        const productContextIds = await this.resolveContextIds(
          ContextType.PRODUCT,
          request.productId
        );
        
        // İkisini birleştir (product bilgileri öncelikli)
        contextIds = {
          ...categoryContextIds,
          ...productContextIds,
        };
        
        logger.info({
          message: 'Experience post created with mixed context (category + product)',
          contextType: request.contextType,
          contextId: request.contextId,
          productId: request.productId,
          resolvedContextIds: contextIds,
        });
      } else {
        // Eski davranış: sadece product context izin verilir
        throw new Error(
          'Experience posts require either: (1) product context, or (2) sub-category/product-group context with productId field'
        );
      }

      if (!contextIds.productId) {
        throw new Error('Product ID is required for experience posts');
      }

      // ✅ YENİ: "I owned" status ise envanter kontrolü yap (tried için kontrol yok)
      if (request.status === ExperienceStatus.OWN && !adminOptions?.skipInventoryCheck) {
        const hasProduct = await this.inventoryService.hasProductInInventory(
          userId,
          contextIds.productId
        );

        if (!hasProduct) {
          logger.warn({
            message: 'User attempted to create owned experience post for product not in inventory',
            userId,
            productId: contextIds.productId,
            status: request.status,
          });
          throw new ValidationError(
            'Bu ürün "Sahip Olduğum" olarak işaretlenmiş ancak envanterinizde bulunmuyor. Lütfen önce ürünü envanterinize ekleyin veya "Denedim" seçeneğini kullanın.'
          );
        }
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
        // Ürünün kendi görselini envanter kaydına ekle (post görselleri değil, ürün görseli)
        const existingMedia = await this.prisma.inventoryMedia.findFirst({
          where: { inventoryId: inventory.id },
        });
        if (!existingMedia) {
          const product = await this.prisma.product.findUnique({
            where: { id: contextIds.productId },
            select: { imageUrl: true },
          });
          if (product?.imageUrl) {
            await this.prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: product.imageUrl,
              },
            });
          }
        }
        logger.info({
          message: 'Inventory upserted for experience post (I owned)',
          userId,
          productId: contextIds.productId,
          inventoryId: inventory.id,
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
        true,
        false,
        request.eventId,
        productStatus,
        contextIds.categoryId
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

      // Tags = duration, location, purpose seçimlerinin isimleri (kullanıcı bu 3'ünü seçer, etiket olarak kaydedilir)
      const [duration, location, purpose] = await Promise.all([
        request.selectedDurationId
          ? this.prisma.experienceDuration.findUnique({ where: { id: request.selectedDurationId }, select: { name: true } })
          : null,
        request.selectedLocationId
          ? this.prisma.experienceLocation.findUnique({ where: { id: request.selectedLocationId }, select: { name: true } })
          : null,
        request.selectedPurposeId
          ? this.prisma.experiencePurpose.findUnique({ where: { id: request.selectedPurposeId }, select: { name: true } })
          : null,
      ]);
      const tagLabels = [duration?.name, location?.name, purpose?.name].filter((n): n is string => Boolean(n?.trim()));
      if (tagLabels.length > 0) {
        await this.prisma.contentPostTag.createMany({
          data: tagLabels.map((tag) => ({
            postId: post.id,
            tag: tag.slice(0, 50),
          })),
        });
      }

      logger.info(`Experience post created: ${post.id} by user ${userId}`, {
        experienceSnippetId: request.experienceSnippetId || null
      });

      // Log action (fire-and-forget)
      this.actionLogService
        .logAction({
          userId,
          mainAction: MainAction.POST,
          actionTypeCode: 'EXPERIENCE',
          entityType: 'post',
          entityId: post.id,
          metadata: {
            postType: ContentPostType.EXPERIENCE,
            categoryId: contextIds.categoryId,
            productId: contextIds.productId,
            hasMedia: (request.images && request.images.length > 0) || false,
            mediaCount: request.images?.length || 0,
            status: request.status,
          },
        })
        .catch((err) => {
          logger.warn('Failed to log action', { error: getErrorMessage(err) });
        });

      // Collection badge progress (POST + EXPERIENCE) - async
      this.achievementProgressService
        .incrementProgressByCode(userId, MainAction.POST, 'EXPERIENCE', 1)
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

      // Keyword-based badge progress (async, fire-and-forget)
      this.achievementProgressService
        .incrementKeywordProgress(userId, ContentPostType.EXPERIENCE, request.description || '')
        .catch((err) => {
          logger.warn({ message: 'Failed to check keyword progress', userId, postId: post.id, error: getErrorMessage(err) });
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
    request: SplitExperienceRequest,
  ): Promise<SplitExperienceResponse> {
    const pipeline = new AIPipelineLogger({
      pipelineName: 'PostService',
      operationName: 'splitExperience',
      totalStages: 3,
      metadata: { userId: request.userId, productId: request.productId },
    });

    try {
      // [1/3] Ürün bilgilerini al
      const product = await pipeline.runStage('Loading product', async () => {
        const p = await this.prisma.product.findUnique({
          where: { id: request.productId },
          include: { brand: true },
        });
        if (!p) throw new Error('Product not found');
        return p;
      });

      // [2/3] Gemini AI ile deneyimi ayır
      const splitResult = await pipeline.runStage('Splitting experience with AI', () =>
        this.geminiService.splitExperience({
          productId: request.productId,
          productName: product.name,
          productBrand: product.brand?.name || undefined,
          productDescription: product.description || undefined,
          experienceText: request.content,
        }),
      );

      // [3/3] AI split sonucunu database'e kaydet
      const experienceSnippet = await pipeline.runStage('Saving to database', () =>
        this.experienceSnippetRepo.create({
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
   * Güncelleme gönderisi oluştur
   */
  async createUpdatePost(
    userId: string,
    request: CreateUpdatePostRequest,
    adminOptions?: AdminCreateOptions
  ): Promise<{ id: string; message: string; success: boolean }> {
    try {
      // Update posts are always for products (contextType is normalized to PRODUCT in router)
      const contextType = ContextType.PRODUCT;

      // Experience post validation - update posts can only be created on experience posts
      if (!request.experiencePostId) {
        throw new Error('experiencePostId is required for update posts');
      }

      // experiencePostId: ULID veya UUID (ContentFavorite id) ile gelebilir; diğer servislerdeki gibi çözümle
      const resolvedExperiencePostId = await this.idResolver.resolvePostId(request.experiencePostId);
      
      logger.debug(`[Create Update Post] ID Resolution result`, {
        original: request.experiencePostId,
        resolved: resolvedExperiencePostId,
      });

      if (!resolvedExperiencePostId) {
        // Check if this is a legacy inventory ID (UUID format)
        if (
          request.experiencePostId.length === 36 &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.experiencePostId)
        ) {
          throw new Error('LEGACY_INVENTORY_NO_POST');
        }
        throw new Error('Experience post not found');
      }

      const experiencePost = await this.prisma.contentPost.findUnique({
        where: { id: resolvedExperiencePostId },
        select: { id: true, userId: true, type: true, productId: true },
      });

      if (!experiencePost) {
        // Check if this is a legacy inventory ID (UUID format)
        if (
          request.experiencePostId.length === 36 &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.experiencePostId)
        ) {
          throw new Error('Cannot create update post for legacy inventory-based reviews. Please create a new experience post first.');
        }
        throw new Error('Experience post not found');
      }

      if (experiencePost.userId !== userId && !adminOptions?.skipInventoryCheck) {
        throw new Error('You can only create update posts on your own experience posts');
      }

      if (experiencePost.type !== ContentPostType.EXPERIENCE) {
        throw new Error('Update posts can only be created on experience posts');
      }

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      // contextId opsiyonel: boşsa deneyim gönderisindeki productId kullanılır (Medusa: tek category tablosu, contextId zorunlu değil).
      const effectiveContextId =
        (request.contextId && String(request.contextId).trim()) || experiencePost.productId;
      if (!effectiveContextId) {
        throw new Error('Product context is required; experience post has no product. Either send contextId or ensure the experience post has a product.');
      }

      const contextIds = await this.resolveContextIds(
        contextType,
        effectiveContextId
      );

      // Verify that the experience post is for the same product
      if (experiencePost.productId !== contextIds.productId) {
        throw new Error('Experience post and update post must be for the same product');
      }

      // ✅ Update posts do NOT require inventory check
      // If experience post exists (owned or tried), user can post updates regardless of current inventory status

      // Segmentli deneyim (AI split) verilmişse body'ye experience gönderisiyle AYNI formatta
      // ekle: feed.parseExperienceContent bu marker'ları ([type] ... (Rating: x/5)) okuyup
      // update gönderisinin kendi experienceContent'ini üretir. Verilmezse düz metin saklanır.
      const segmentedText =
        request.experience && request.experience.length > 0
          ? request.experience
              .map(
                (exp) =>
                  `[${exp.type}] ${exp.content} (Rating: ${exp.rating}/5)`
              )
              .join('\n\n')
          : '';
      const updateBody = segmentedText
        ? `${request.content}\n\n${segmentedText}`
        : request.content;

      const bodyWithImages = this.appendImagesToBody(
        updateBody,
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
        true,
        false,
        request.eventId,
        undefined,
        contextIds.categoryId
      );

      // AI split snippet ID'sini kaydet (varsa; fallback'te gönderilmez)
      if (request.experienceSnippetId) {
        await this.prisma.contentPost.update({
          where: { id: post.id },
          data: { experienceSnippetId: request.experienceSnippetId },
        });
      }

      // Create PostUpdateContent record (resolved experience post id kullan)
      // content = kullanıcının yazdığı orijinal düz metin ("Orijinal" görünümü için).
      await this.prisma.postUpdateContent.create({
        data: {
          postId: post.id,
          experiencePostId: resolvedExperiencePostId,
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

      logger.info(`Update post created: ${post.id} by user ${userId} for experience post ${resolvedExperiencePostId}`);
      
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

      // Keyword-based badge progress (async, fire-and-forget)
      this.achievementProgressService
        .incrementKeywordProgress(userId, ContentPostType.UPDATE, request.description || '')
        .catch((err) => {
          logger.warn({ message: 'Failed to check keyword progress', userId, postId: post.id, error: getErrorMessage(err) });
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
  ): Promise<Array<{
    inventoryId: string;
    hasOwned: boolean;
    experienceSummary: string | null;
    experiences: unknown[];
    media: Array<{ id: string; mediaUrl: string }>;
  }>> {
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

    let durationId = resolveOption(params.durationId, options.durations, 'duration');
    let locationId = resolveOption(params.locationId, options.locations, 'location');
    let purposeId = resolveOption(params.purposeId, options.purposes, 'purpose');

    // İsim DB'de yoksa ilk kullanımda oluştur (seed gerekmez, uygulama gönderdiği değerle çalışır)
    const ensureOption = async (
      value: string | null | undefined,
      resolvedId: string | null,
      upsertFn: (args: { where: { name: string }; create: { name: string; isActive: boolean }; update: object }) => Promise<{ id: string }>
    ): Promise<string | null> => {
      if (resolvedId) return resolvedId;
      if (!value || typeof value !== 'string') return null;
      const name = value.trim();
      if (!name || uuidRegex.test(name)) return null;
      const created = await upsertFn({ where: { name }, create: { name, isActive: true }, update: {} });
      logger.info(`Experience option created on first use`, { name, id: created.id });
      return created.id;
    };

    durationId = await ensureOption(params.durationId, durationId, (args) =>
      this.prisma.experienceDuration.upsert(args)
    );
    locationId = await ensureOption(params.locationId, locationId, (args) =>
      this.prisma.experienceLocation.upsert(args)
    );
    purposeId = await ensureOption(params.purposeId, purposeId, (args) =>
      this.prisma.experiencePurpose.upsert(args)
    );

    return { durationId, locationId, purposeId };
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
   * Gelen id'yi ContentPost.id'ye çözümler (tüm id tiplerine izin vermek için).
   * Kabul eder: ContentPost.id (herhangi uzunluk), ContentFavorite.id (UUID), vb.
   * Önce ContentPost'ta ara; bulunamazsa UUID ise ContentFavorite.id üzerinden postId döner.
   */
  /** IdResolver'a delege eder; router ve diğer servisler bu metodu kullanabilir. */
  async resolvePostId(id: string): Promise<string | null> {
    return this.idResolver.resolvePostId(id);
  }

  /**
   * Post ID'sine göre post detayını getirir.
   * Parametre ContentPost.id veya ContentFavorite.id (UUID) olabilir; resolvePostId ile çözülür.
   * userId verilirse isOwned vb. doğru hesaplanır.
   */
  async getPostById(postId: string, userId?: string): Promise<unknown> {
    const resolvedPostId = await this.resolvePostId(postId);
    if (!resolvedPostId) return null;

    const post = await this.prisma.contentPost.findUnique({
      where: { id: resolvedPostId },
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
        updateContent: {
          include: {
            experiencePost: {
              include: {
                product: {
                  include: {
                    group: {
                      include: {
                        subCategory: { include: { mainCategory: true } },
                      },
                    },
                  },
                },
                contentPostTags: true,
                media: { orderBy: { orderIndex: 'asc' as const } },
              },
            },
          },
        },
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

    try {
      // Cast to FeedContentPost for mapping helpers (Prisma return type is a structural superset)
      const feedItem = await this.feedService.getPostAsFeedItem(post as unknown as Parameters<typeof this.feedService.getPostAsFeedItem>[0], userId);
      const data = feedItem?.data ?? null;
      if (!data) return null;

      if (post.type === ContentPostType.UPDATE && post.updateContent?.experiencePostId) {
        const experiencePostId = post.updateContent.experiencePostId;
        const allUpdatesForExperience = await this.prisma.postUpdateContent.findMany({
          where: { experiencePostId },
          include: {
            post: {
              include: {
                media: { orderBy: { orderIndex: 'asc' } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
        const relatedUpdates = allUpdatesForExperience.map((uc) => ({
          id: uc.post.id,
          content: uc.content,
          images: (uc.post.media || []).map((m: { mediaUrl: string }) => resolveMediaUrl(m.mediaUrl)).filter(Boolean) as string[],
          createdAt: uc.post.createdAt.toISOString(),
        }));
        return { ...data, relatedUpdates };
      }

      return data;
    } catch (err) {
      logger.error({
        message: 'getPostAsFeedItem failed in getPostById',
        postId: resolvedPostId,
        postType: post.type,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async deletePost(userId: string, postId: string): Promise<boolean> {
    try {
      const resolvedPostId = await this.resolvePostId(postId?.trim() || '');
      if (!resolvedPostId) {
        return false; // Router 404 dönecek
      }

      const post = await this.postRepo.findById(resolvedPostId);

      if (!post) {
        return false; // Router 404 dönecek
      }

      if (!post.belongsToUser(userId)) {
        throw new Error('Forbidden: user does not own this post');
      }

      // Post'un eventId'sini al (cache invalidation için) - Prisma'dan direkt çek
      const postWithEvent = await this.prisma.contentPost.findUnique({
        where: { id: resolvedPostId },
        select: { eventId: true }
      });
      const eventId = postWithEvent?.eventId || null;

      const deleted = await this.postRepo.delete(resolvedPostId);

      if (deleted) {
        logger.info(`Post deleted: ${resolvedPostId} by user ${userId}`);
        
        // Event cache'i invalidate et (eventId varsa)
        if (eventId) {
          this.eventService.invalidateEventCaches(eventId, userId).catch((err) => {
            logger.warn({ message: 'Failed to invalidate event caches', eventId, error: err });
          });
        }
      } else {
        logger.warn(`Post delete returned false for id: ${resolvedPostId}`);
      }

      return deleted;
    } catch (error) {
      logger.error(`Failed to delete post ${postId} by user ${userId}`, error);
      throw error;
    }
  }
}

