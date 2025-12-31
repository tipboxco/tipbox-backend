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
  BoostOption,
  SplitExperienceRequest,
  SplitExperienceResponse,
  Experience,
} from '../../interfaces/post/post.dto';
import { PrismaClient } from '@prisma/client';
import { FeedService } from '../feed/feed.service';
import logger from '../../infrastructure/logger/logger';
import { GeminiService } from '../../infrastructure/ai/gemini.service';
import { AiExperienceSplitPrismaRepository } from '../../infrastructure/repositories/ai-experience-split-prisma.repository';
import { withCache } from '../../infrastructure/cache/cache-wrapper.helper';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';

export class PostService {
  private postRepo: ContentPostPrismaRepository;
  private tipRepo: PostTipPrismaRepository;
  private questionRepo: PostQuestionPrismaRepository;
  private comparisonRepo: PostComparisonPrismaRepository;
  private feedService: FeedService;
  private prisma: PrismaClient;
  private geminiService: GeminiService;
  private experienceSnippetRepo: AiExperienceSplitPrismaRepository;

  constructor() {
    this.postRepo = new ContentPostPrismaRepository();
    this.tipRepo = new PostTipPrismaRepository();
    this.questionRepo = new PostQuestionPrismaRepository();
    this.comparisonRepo = new PostComparisonPrismaRepository();
    this.feedService = new FeedService();
    this.prisma = new PrismaClient();
    this.geminiService = GeminiService.getInstance();
    this.experienceSnippetRepo = new AiExperienceSplitPrismaRepository();
  }

  /**
   * Event validation - event mevcut ve aktif mi kontrol eder
   */
  private async validateEvent(eventId: string): Promise<void> {
    const event = await this.prisma.wishboxEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
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
        const subCategory = await this.prisma.subCategory.findUnique({
          where: { id: contextId },
          include: { mainCategory: true },
        });
        if (!subCategory) {
          throw new Error(`Sub category not found: ${contextId}`);
        }
        return {
          subCategoryId: contextId,
          mainCategoryId: subCategory.mainCategoryId || undefined,
        };

      case ContextType.PRODUCT_GROUP:
        const productGroup = await this.prisma.productGroup.findUnique({
          where: { id: contextId },
          include: { subCategory: { include: { mainCategory: true } } },
        });
        if (!productGroup) {
          throw new Error(`Product group not found: ${contextId}`);
        }
        return {
          productGroupId: contextId,
          subCategoryId: productGroup.subCategoryId || undefined,
          mainCategoryId: productGroup.subCategory?.mainCategoryId || undefined,
        };

      case ContextType.PRODUCT:
        const product = await this.prisma.product.findUnique({
          where: { id: contextId },
          include: {
            group: {
              include: {
                subCategory: { include: { mainCategory: true } },
              },
            },
          },
        });
        if (!product) {
          throw new Error(`Product not found: ${contextId}`);
        }
        return {
          productId: contextId,
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

      const post = await this.postRepo.create(
        userId,
        ContentPostType.FREE,
        '', // Title will be auto-generated or empty
        bodyWithImages,
        contextIds.subCategoryId,
        contextIds.mainCategoryId,
        contextIds.productGroupId,
        contextIds.productId,
        false, // inventoryRequired
        false, // isBoosted
        request.eventId // eventId
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

      logger.info(`Free post created: ${post.id} by user ${userId}`);
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Post başarıyla oluşturuldu',
        success: true
      };
    } catch (error) {
      logger.error(`Failed to create free post:`, error);
      throw error;
    }
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
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Tips & tricks post başarıyla oluşturuldu',
        success: true
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
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Question post başarıyla oluşturuldu',
        success: true
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
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Benchmark post başarıyla oluşturuldu',
        success: true
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

      // Map status to hasOwned: OWN = true, TEST = false
      const hasOwned = request.status === ExperienceStatus.OWN;

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
        request.eventId // eventId
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
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Experience post başarıyla oluşturuldu',
        success: true
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
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Gemini AI ile deneyimi ayır
      const splitResult = await this.geminiService.splitExperience({
        productId: request.productId,
        productName: product.name,
        productBrand: product.brand || undefined,
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

      // Event validation (if eventId is provided)
      if (request.eventId) {
        await this.validateEvent(request.eventId);
      }

      const contextIds = await this.resolveContextIds(
        request.contextType,
        request.contextId
      );

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

      logger.info(`Update post created: ${post.id} by user ${userId}`);
      
      // Post'u ilgili kullanıcıların feed'ine ekle (async, hata olsa bile devam et)
      this.feedService.addPostToFeeds(post.id, userId).catch((err) => {
        logger.warn({ message: 'Failed to add post to feeds', postId: post.id, error: err });
      });
      
      return { 
        id: post.id,
        message: 'Update post başarıyla oluşturuldu',
        success: true
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
          productExperiences: true,
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
          experiences: inventory.productExperiences.map((exp) => ({
            id: exp.id,
            title: exp.title,
            experienceText: exp.experienceText,
            createdAt: exp.createdAt,
          })),
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
  async deletePost(userId: string, postId: string): Promise<boolean> {
    try {
      const post = await this.postRepo.findById(postId);

      if (!post) {
        return false; // Router 404 dönecek
      }

      if (!post.belongsToUser(userId)) {
        throw new Error('Forbidden: user does not own this post');
      }

      const deleted = await this.postRepo.delete(postId);

      if (deleted) {
        logger.info(`Post deleted: ${postId} by user ${userId}`);
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

