import { FeedItemType } from '../../domain/feed/feed-item-type.enum';
import { ContextType as DomainContextType } from '../../domain/content/context-type.enum';

/**
 * @openapi
 * components:
 *   schemas:
 *     BaseUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         title:
 *           type: string
 *         avatar:
 *           type: string
 *           nullable: true
 *     BaseStats:
 *       type: object
 *       properties:
 *         likes:
 *           type: integer
 *         comments:
 *           type: integer
 *         shares:
 *           type: integer
 *         bookmarks:
 *           type: integer
 *     ContextData:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         subName:
 *           type: string
 *           nullable: true
 *         image:
 *           type: string
 *           nullable: true
 *         isOwned:
 *           type: boolean
 *           nullable: true
 *     BasePost:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/BaseUser'
 *         stats:
 *           $ref: '#/components/schemas/BaseStats'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         contextType:
 *           type: string
 *           enum: [product_group, product, sub_category]
 *         source:
 *           type: string
 *           nullable: true
 *           description: Feed source (TRUSTER, BOOSTED, CATEGORY_MATCH, TRENDING, NEW_USER, etc.)
 *     Post:
 *       type: object
 *       allOf:
 *         - $ref: '#/components/schemas/BasePost'
 *         - type: object
 *           properties:
 *             contextData:
 *               $ref: '#/components/schemas/ContextData'
 *             content:
 *               type: string
 *             images:
 *               type: array
 *               items:
 *                 type: string
 *               nullable: true
 *     BenchmarkPost:
 *       type: object
 *       allOf:
 *         - $ref: '#/components/schemas/BasePost'
 *         - type: object
 *           properties:
 *             contextData:
 *               $ref: '#/components/schemas/ContextData'
 *             content:
 *               type: string
 *             products:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   subName:
 *                     type: string
 *                   image:
 *                     type: string
 *                     nullable: true
 *                   isOwned:
 *                     type: boolean
 *                   choice:
 *                     type: boolean
 *     TipsAndTricksPost:
 *       type: object
 *       allOf:
 *         - $ref: '#/components/schemas/BasePost'
 *         - type: object
 *           properties:
 *             contextData:
 *               $ref: '#/components/schemas/ContextData'
 *             content:
 *               type: string
 *             tag:
 *               type: string
 *             images:
 *               type: array
 *               items:
 *                 type: string
 *               nullable: true
 *     ExperiencePost:
 *       type: object
 *       allOf:
 *         - $ref: '#/components/schemas/BasePost'
 *         - type: object
 *           properties:
 *             content:
 *               oneOf:
 *                 - type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       rating:
 *                         type: number
 *                 - type: string
 *             experienceContent:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *                   rating:
 *                     type: number
 *               nullable: true
 *             tags:
 *               type: array
 *               items:
 *                 type: string
 *             images:
 *               type: array
 *               items:
 *                 type: string
 *               nullable: true
 *     UpdatePost:
 *       type: object
 *       allOf:
 *         - $ref: '#/components/schemas/BasePost'
 *         - type: object
 *           properties:
 *             relatedPost:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 product:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     subName:
 *                       type: string
 *                     image:
 *                       type: string
 *                       nullable: true
 *                 content:
 *                   oneOf:
 *                     - type: array
 *                       items:
 *                         type: object
 *                     - type: string
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 images:
 *                   type: array
 *                   items:
 *                     type: string
 *             content:
 *               type: string
 *             images:
 *               type: array
 *               items:
 *                 type: string
 *               nullable: true
 */

// Re-export FeedItemType for convenience
export { FeedItemType };

// Base Types
export type ID = string;
export type URLString = string;

export type ContextType = DomainContextType;

// Context metadata used for card header
export interface ContextData {
  id: string;        // contextType'e göre: productId / productGroupId / subCategoryId
  name: string;      // kart başlığı: ürün / grup / subcategory adı
  subName?: string;  // bir üst seviye adı (örn. product -> product group)
  image?: string | null;       // görsel URL'si
  isOwned?: boolean; // sadece PRODUCT context'inde anlamlı
}

export interface BaseUser {
  id: ID;
  name: string;
  title: string;
  /**
   * Yeni tercih edilen alan adı - avatar
   */
  avatar?: URLString;
}

export interface BaseStats {
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
}

export interface BasePost {
  /** Post/kayıt id'si. Format (UUID, ULID, Medusa vb.) önemsiz; tablodaki değerle eşleşmesi önemli. */
  id: string;
  type?: FeedItemType; // Optional - type is only at FeedItem root level, not in data object
  user: BaseUser;
  stats: BaseStats;
  createdAt: string;
  contextType: ContextType;
  source?: string; // Feed source: TRUSTER, BOOSTED, CATEGORY_MATCH, TRENDING, NEW_USER
}


export interface BaseProduct {
  id: string;
  name: string;
  subName: string;
  image: string | null; // URL or image object
  isOwned?: boolean;
}


// Post Item Types
export interface Post extends BasePost {
  contextData: ContextData;
  content: string;
  images?: string[];
}

// Benchmark Post Item Types
export interface BenchmarkProduct extends BaseProduct {
  isOwned: boolean;
  choice: boolean;
}

export interface BenchmarkPost extends BasePost {
  contextData: ContextData;
  content: string;
}

// Review / Experience Post Item Types
export type ContentType = 'Price and Shopping Experience' | 'Product and Usage Experience';

export interface ExperienceContent {
  title: ContentType;
  content: string;
  rating: number;
}

export interface ReviewProduct extends BaseProduct {
  // future: aggregate review stats can be added here
}

export interface ExperiencePost extends BasePost {
  content: ExperienceContent[] | string; // Support both array (legacy) and string (mobile compatibility)
  experienceContent?: ExperienceContent[]; // Structured data (optional, for backward compatibility)
  tags: string[];
  images?: string[];
  /** I owned / I tried: 'own' | 'tried' */
  status?: 'own' | 'tried';
  statusLabel?: 'I owned' | 'I tried';
}

// Update Post Item Types
export interface RelatedPostData {
  id: string;
  product: BaseProduct | null;
  content: ExperienceContent[] | string; // Support both array (legacy) and string (mobile compatibility)
  experienceContent?: ExperienceContent[]; // Structured data (optional, for backward compatibility)
  tags: string[];
  images: string[];
}

export interface UpdatePost extends BasePost {
  relatedPost: RelatedPostData;
  content: string;
  images?: string[];
}

export interface TipsAndTricksPost extends BasePost {
  contextData: ContextData;
  content: string;
  tag: string;
  images?: string[];
}

export interface RepliesPost extends BasePost {
  contextData: ContextData;
  content: string;
  isBoosted: boolean;
  images?: string[];
}

// Feed Item Union Type
export type FeedItem =
  | { type: FeedItemType.BENCHMARK; data: BenchmarkPost }
  | { type: FeedItemType.POST; data: Post }
  | { type: FeedItemType.QUESTION; data: Post }
  | { type: FeedItemType.TIPS_AND_TRICKS; data: TipsAndTricksPost }
  | { type: FeedItemType.EXPERIENCE; data: ExperiencePost }
  | { type: FeedItemType.UPDATE; data: UpdatePost };

// Feed Response
export interface FeedResponse {
  items: FeedItem[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
    total?: number;
  };
}

// Feed Filter Options
export interface FeedFilterOptions {
  /**
   * User interests - Feed source filters (e.g. TRUSTER, TRENDING, MUTUAL_TRUST, BOOSTED, etc.)
   * Artık kategori ID'leri yerine feed source'ları kullanılıyor
   */
  interests?: string[];
  /**
   * Tags to filter posts by
   */
  tags?: string[];
  /**
   * Single primary category filter
   */
  category?: string;
  /**
   * Sort strategy for filtered feed
   * - recent: newest first
   * - top: based on engagement (likes/views)
   */
  sort?: 'recent' | 'top';
  /**
   * Filter by product IDs
   */
  productIds?: string[];
  /**
   * Filter by user IDs
   */
  userIds?: string[];
  /**
   * Filter by date range
   */
  dateRange?: {
    from?: string;
    to?: string;
  };
  /**
   * Minimum number of likes required
   */
  minLikes?: number;
  /**
   * Minimum number of comments required
   */
  minComments?: number;
  /**
   * Filter by feed item types
   */
  types?: FeedItemType[];
  /**
   * Context type for context-based filtering
   * - sub_category: Sub category feed
   * - product_group: Product group feed
   * - product: Product feed
   */
  contextType?: ContextType;
  /**
   * Context ID for context-based filtering
   * - subCategoryId if contextType is sub_category
   * - productGroupId if contextType is product_group
   * - productId if contextType is product
   */
  contextId?: string;
}

