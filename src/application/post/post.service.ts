import { ContentPostPrismaRepository } from '../../infrastructure/repositories/content-post-prisma.repository';
import { PostTipPrismaRepository } from '../../infrastructure/repositories/post-tip-prisma.repository';
import { PostQuestionPrismaRepository } from '../../infrastructure/repositories/post-question-prisma.repository';
import { PostComparisonPrismaRepository } from '../../infrastructure/repositories/post-comparison-prisma.repository';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { ContextType } from '../../domain/content/context-type.enum';
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
import logger from '../../infrastructure/logger/logger';

export class PostService {
  private postRepo: ContentPostPrismaRepository;
  private tipRepo: PostTipPrismaRepository;
  private questionRepo: PostQuestionPrismaRepository;
  private comparisonRepo: PostComparisonPrismaRepository;
  private prisma: PrismaClient;

  constructor() {
    this.postRepo = new ContentPostPrismaRepository();
    this.tipRepo = new PostTipPrismaRepository();
    this.questionRepo = new PostQuestionPrismaRepository();
    this.comparisonRepo = new PostComparisonPrismaRepository();
    this.prisma = new PrismaClient();
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
    if (!images || images.length === 0) {
      return body;
    }

    const imageMarkdown = images
      .map((url) => `![Image](${url})`)
      .join('\n\n');

    return `${body}\n\n${imageMarkdown}`;
  }

  /**
   * Serbest gönderi oluştur
   */
  async createFreePost(
    userId: string,
    request: CreatePostRequest
  ): Promise<{ id: string }> {
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
        false // isBoosted
      );

      logger.info(`Free post created: ${post.id} by user ${userId}`);
      return { id: post.id };
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
  ): Promise<{ id: string }> {
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
        false
      );

      // Create PostTip
      await this.tipRepo.create(
        post.id, // post.id is already a string (VarChar(26))
        tipCategory,
        false // isVerified - can be verified later
      );

      logger.info(
        `Tips and tricks post created: ${post.id} by user ${userId}`
      );
      return { id: post.id };
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
  ): Promise<{ id: string }> {
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
        true // isBoosted - question posts are boosted
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

      logger.info(`Question post created: ${post.id} by user ${userId}`);
      return { id: post.id };
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
    try {
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
    } catch (error) {
      logger.error('Failed to get boost options', error);
      throw error;
    }
  }

  /**
   * Karşılaştırma gönderisi oluştur
   */
  async createBenchmarkPost(
    userId: string,
    request: CreateBenchmarkPostRequest
  ): Promise<{ id: string }> {
    try {
      // Benchmark posts can only be created for products
      if (request.contextType !== ContextType.PRODUCT) {
        throw new Error('Benchmark posts can only be created for products');
      }

      // Validate that at least 2 products are selected
      const selectedProducts = request.products.filter((p) => p.isSelected);
      if (selectedProducts.length < 2) {
        throw new Error('At least 2 products must be selected for comparison');
      }

      // For now, we'll compare the first 2 selected products
      const product1 = selectedProducts[0];
      const product2 = selectedProducts[1];

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
        false
      );

      // Create PostComparison
      await this.comparisonRepo.create(
        post.id, // post.id is already a string (VarChar(26))
        product1.productId, // productId is already a string (UUID)
        product2.productId // productId is already a string (UUID)
      );

      logger.info(`Benchmark post created: ${post.id} by user ${userId}`);
      return { id: post.id };
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
  ): Promise<{ id: string }> {
    try {
      // Experience posts can only be created for products
      if (request.contextType !== ContextType.PRODUCT) {
        throw new Error('Experience posts can only be created for products');
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
        false
      );

      logger.info(`Experience post created: ${post.id} by user ${userId}`);
      return { id: post.id };
    } catch (error) {
      logger.error(`Failed to create experience post:`, error);
      throw error;
    }
  }

  /**
   * AI ile deneyimi ayır
   */
  async splitExperience(
    request: SplitExperienceRequest
  ): Promise<SplitExperienceResponse> {
    try {
      // TODO: Implement AI service to split experience
      // For now, returning a mock implementation
      // This should call an AI service to categorize the experience

      // Mock implementation - split by keywords
      const content = request.content.toLowerCase();
      const experiences: Experience[] = [];

      // Simple keyword-based categorization
      const priceKeywords = ['price', 'cost', 'buy', 'purchase', 'shop', 'money', 'affordable', 'expensive'];
      const usageKeywords = ['use', 'usage', 'experience', 'quality', 'performance', 'result', 'effect'];

      const hasPriceContent = priceKeywords.some((keyword) =>
        content.includes(keyword)
      );
      const hasUsageContent = usageKeywords.some((keyword) =>
        content.includes(keyword)
      );

      if (hasPriceContent) {
        experiences.push({
          type: ExperienceType.PRICE_AND_SHOPPING,
          content: request.content,
          rating: 4, // Default rating
        });
      }

      if (hasUsageContent) {
        experiences.push({
          type: ExperienceType.PRODUCT_AND_USAGE,
          content: request.content,
          rating: 4, // Default rating
        });
      }

      // If no keywords found, default to product and usage
      if (experiences.length === 0) {
        experiences.push({
          type: ExperienceType.PRODUCT_AND_USAGE,
          content: request.content,
          rating: 4,
        });
      }

      return { experiences };
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
  ): Promise<{ id: string }> {
    try {
      // Update posts can only be created for products
      if (request.contextType !== ContextType.PRODUCT) {
        throw new Error('Update posts can only be created for products');
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
        false
      );

      logger.info(`Update post created: ${post.id} by user ${userId}`);
      return { id: post.id };
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
            type: m.type,
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

